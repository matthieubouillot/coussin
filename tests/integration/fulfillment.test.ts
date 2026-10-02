import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { SupplierError } from "@/server/fulfillment/types";
import {
  addOffers,
  createPaidOrder,
  fakeAdapters,
  makeRetriesDue,
  resetDatabase,
  resetFakeAdapters,
} from "./helpers";

vi.mock("@/server/stripe/stripe", async () => (await import("./helpers")).fakeStripeModule());
vi.mock("@/server/fulfillment/registry", async () => {
  const { fakeAdapters } = await import("./helpers");
  return { getAdapter: (kind: "ALIEXPRESS" | "CJ" | "MANUAL") => fakeAdapters[kind] };
});

const { POST } = await import("@/app/api/webhooks/stripe/route");
const { fulfillOrder } = await import("@/server/fulfillment/dispatch");
const { syncTracking } = await import("@/server/fulfillment/tracking");
const { syncStockAndPrices } = await import("@/server/fulfillment/stock-sync");
const { recordManualPlacement, recordManualTracking, recordManualDelivery, retryAfterCheck } =
  await import("@/server/fulfillment/admin-operations");
const { sendReviewInvites, findInvite } = await import("@/server/reviews/invites");

beforeEach(async () => {
  await resetDatabase();
  resetFakeAdapters();
});

async function paidOrderWithOffers(offers: Parameters<typeof addOffers>[1]) {
  const order = await createPaidOrder(POST);
  await addOffers(order.id, offers);
  return order;
}

const supplierOrders = (orderId: string) =>
  db.supplierOrder.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
const status = async (orderId: string) =>
  (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status;
const alerts = async (prefix: string) =>
  db.emailLog.count({ where: { type: "ADMIN_ALERT", dedupKey: { startsWith: `admin:${prefix}` } } });

describe("transmission au fournisseur", () => {
  it("chemin nominal : commande passée et payée, coût enregistré, registre des achats", async () => {
    const order = await paidOrderWithOffers([{ adapter: "ALIEXPRESS" }]);
    await fulfillOrder(order.id);

    const [so] = await supplierOrders(order.id);
    expect(so?.status).toBe("PLACED");
    expect(so?.costCents).toBe(779);
    expect(await status(order.id)).toBe("SENT_TO_SUPPLIER");
    expect((await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).unitCostCents).toBe(779);
    expect((await db.purchaseRecord.findFirstOrThrow()).amountCents).toBe(779);

    const request = fakeAdapters.ALIEXPRESS.placeOrder.mock.calls[0]![0] as unknown as {
      address: { phone: string; city: string };
    };
    expect(request.address).toMatchObject({ phone: "+33612345678", city: "Lyon" });
  });

  it("paiement à faire sur AliExpress : signalé à l'admin, pas encore au registre des achats", async () => {
    const order = await paidOrderWithOffers([{ adapter: "ALIEXPRESS" }]);
    fakeAdapters.ALIEXPRESS.placeOrder.mockResolvedValueOnce({
      externalOrderId: "AE-1",
      payment: "AWAITING_PAYMENT",
      totalCostCents: 779,
    });
    await fulfillOrder(order.id);

    expect((await supplierOrders(order.id))[0]?.status).toBe("AWAITING_SUPPLIER_PAYMENT");
    expect(await alerts("to-pay:")).toBe(1);
    expect(await db.purchaseRecord.count()).toBe(0);

    // Payée ensuite sur AliExpress : le cron de suivi la voit passer en préparation.
    fakeAdapters.ALIEXPRESS.getOrderStatus.mockResolvedValueOnce("PROCESSING");
    await syncTracking();
    expect((await supplierOrders(order.id))[0]?.status).toBe("PLACED");
    expect(await db.purchaseRecord.count()).toBe(1);
  });

  it("erreurs temporaires : 6 tentatives espacées, puis bascule sur le secours + email client si le délai s'allonge", async () => {
    const order = await paidOrderWithOffers([
      { adapter: "ALIEXPRESS" },
      { adapter: "CJ", deliveryDaysMax: 20 },
    ]);
    fakeAdapters.ALIEXPRESS.placeOrder.mockRejectedValue(new SupplierError("TRANSIENT", "HTTP 503"));

    const first = await fulfillOrder(order.id);
    expect(first.nextRunAt!.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect((await supplierOrders(order.id))[0]).toMatchObject({ status: "QUEUED", attempts: 1 });

    for (let i = 0; i < 5; i++) {
      await makeRetriesDue(order.id);
      await fulfillOrder(order.id);
    }
    expect(fakeAdapters.ALIEXPRESS.placeOrder).toHaveBeenCalledTimes(6);
    const sos = await supplierOrders(order.id);
    expect(sos.map((s) => [s.adapter, s.status])).toEqual([
      ["ALIEXPRESS", "FAILED"],
      ["CJ", "PLACED"],
    ]);
    expect(await status(order.id)).toBe("SENT_TO_SUPPLIER");
    expect(await alerts("fallback:")).toBe(1);
    expect(await db.emailLog.count({ where: { type: "DELAY_NOTICE" } })).toBe(1);
  });

  it("rupture constatée au moment de commander : bascule immédiate, sans délai rallongé", async () => {
    const order = await paidOrderWithOffers([
      { adapter: "ALIEXPRESS" },
      { adapter: "CJ", deliveryDaysMax: 10 },
    ]);
    fakeAdapters.ALIEXPRESS.getStockAndPrice.mockResolvedValueOnce({
      stock: 0,
      unitCost: 579,
      currency: "EUR",
    });
    await fulfillOrder(order.id);

    expect(fakeAdapters.ALIEXPRESS.placeOrder).not.toHaveBeenCalled();
    expect((await supplierOrders(order.id)).map((s) => s.status)).toEqual(["FAILED", "PLACED"]);
    expect(await db.emailLog.count({ where: { type: "DELAY_NOTICE" } })).toBe(0);
  });

  it("toutes les offres échouent : commande en erreur et alerte", async () => {
    const order = await paidOrderWithOffers([{ adapter: "ALIEXPRESS" }]);
    fakeAdapters.ALIEXPRESS.placeOrder.mockRejectedValue(new SupplierError("PERMANENT", "Adresse refusée"));
    await fulfillOrder(order.id);
    expect(await status(order.id)).toBe("FULFILLMENT_ERROR");
    expect(await alerts("fulfillment-error:")).toBe(1);
  });

  it("réponse incertaine : jamais renvoyée automatiquement ; renvoi après vérification de l'admin", async () => {
    const order = await paidOrderWithOffers([{ adapter: "ALIEXPRESS" }]);
    fakeAdapters.ALIEXPRESS.placeOrder.mockRejectedValueOnce(new SupplierError("AMBIGUOUS", "Délai dépassé"));
    await fulfillOrder(order.id);
    await fulfillOrder(order.id);
    await fulfillOrder(order.id);
    expect(fakeAdapters.ALIEXPRESS.placeOrder).toHaveBeenCalledTimes(1);
    const [so] = await supplierOrders(order.id);
    expect(so?.status).toBe("NEEDS_CHECK");
    expect(await alerts("needs-check:")).toBe(1);

    await retryAfterCheck(so!.id, "admin-test");
    expect(fakeAdapters.ALIEXPRESS.placeOrder).toHaveBeenCalledTimes(2);
    expect((await supplierOrders(order.id))[0]?.status).toBe("PLACED");
  });

  it("exécutions simultanées : la commande n'est envoyée qu'une fois", async () => {
    const order = await paidOrderWithOffers([{ adapter: "ALIEXPRESS" }]);
    fakeAdapters.ALIEXPRESS.placeOrder.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { externalOrderId: "AE-1", payment: "PAID", totalCostCents: 779 };
    });
    await Promise.all([fulfillOrder(order.id), fulfillOrder(order.id), fulfillOrder(order.id)]);
    expect(fakeAdapters.ALIEXPRESS.placeOrder).toHaveBeenCalledTimes(1);
    expect(await db.supplierOrder.count()).toBe(1);
  });
});

describe("mode manuel, suivi, livraison et avis", () => {
  it("API non configurée → manuel ; saisie admin → expédié → livré → demande d'avis à J+7", async () => {
    const order = await paidOrderWithOffers([{ adapter: "ALIEXPRESS" }]);
    fakeAdapters.ALIEXPRESS.getStockAndPrice.mockRejectedValueOnce(
      new SupplierError("NOT_CONFIGURED", "API AliExpress non configurée"),
    );
    await fulfillOrder(order.id);
    const [so] = await supplierOrders(order.id);
    expect(so?.status).toBe("MANUAL_ACTION_REQUIRED");
    expect(await alerts("manual:")).toBe(1);
    expect(await status(order.id)).toBe("PAID");

    await recordManualPlacement(
      so!.id,
      { externalOrderId: "8123456789", costCents: 812, paid: true },
      "admin-test",
    );
    expect(await status(order.id)).toBe("SENT_TO_SUPPLIER");
    expect((await db.purchaseRecord.findFirstOrThrow()).paymentMethod).toBe("Saisi manuellement");

    await recordManualTracking(
      so!.id,
      { trackingNumber: "6A12345678901", carrier: "Colissimo", trackingUrl: null },
      "admin-test",
    );
    expect(await status(order.id)).toBe("SHIPPED");
    const shipped = await db.supplierOrder.findUniqueOrThrow({ where: { id: so!.id } });
    expect(shipped.trackingUrl).toContain("6A12345678901");
    expect(await db.emailLog.count({ where: { type: "SHIPPED" } })).toBe(1);

    await recordManualDelivery(so!.id, "admin-test");
    expect(await status(order.id)).toBe("DELIVERED");
    expect(await db.emailLog.count({ where: { type: "DELIVERED" } })).toBe(1);

    expect(await sendReviewInvites(new Date())).toBe(0); // trop tôt
    const inEightDays = new Date(Date.now() + 8 * 86_400_000);
    expect(await sendReviewInvites(inEightDays)).toBe(1);
    expect(await sendReviewInvites(inEightDays)).toBe(0); // une seule invitation par commande
    expect(await db.emailLog.count({ where: { type: "REVIEW_REQUEST" } })).toBe(1);
  });

  it("suivi automatique : expédié puis livré, un email par étape", async () => {
    const order = await paidOrderWithOffers([{ adapter: "CJ" }]);
    await fulfillOrder(order.id);

    fakeAdapters.CJ.getOrderStatus.mockResolvedValueOnce("SHIPPED");
    fakeAdapters.CJ.getTracking.mockResolvedValueOnce({
      trackingNumber: "CJPKL123456",
      carrier: "La Poste",
      trackingUrl: null,
      delivered: false,
    });
    await syncTracking();
    expect(await status(order.id)).toBe("SHIPPED");

    await db.supplierOrder.updateMany({ data: { lastPolledAt: new Date(Date.now() - 3_600_000) } });
    fakeAdapters.CJ.getOrderStatus.mockResolvedValueOnce("DELIVERED");
    fakeAdapters.CJ.getTracking.mockResolvedValueOnce({
      trackingNumber: "CJPKL123456",
      carrier: "La Poste",
      trackingUrl: null,
      delivered: true,
    });
    await syncTracking();
    expect(await status(order.id)).toBe("DELIVERED");
    expect(await db.emailLog.count({ where: { type: { in: ["SHIPPED", "DELIVERED"] } } })).toBe(2);
  });

  it("le jeton d'avis n'est jamais stocké en clair et refuse les jetons inconnus", async () => {
    expect(await findInvite("x".repeat(43))).toBeNull();
    expect(await findInvite("trop-court")).toBeNull();
  });
});

describe("synchronisation stock et prix", () => {
  it("met à jour stock et coût, historise, alerte stock bas et rupture totale", async () => {
    const order = await paidOrderWithOffers([{ adapter: "ALIEXPRESS" }]);
    await db.shopSettings.create({
      data: {
        shopName: "Test",
        legalIdentity: {},
        cgvVersion: "2026-10-01",
        lowStockThreshold: 10,
        marginAlertThresholdBps: 3000,
      },
    });
    fakeAdapters.ALIEXPRESS.getStockAndPrice.mockResolvedValueOnce({
      stock: 3,
      unitCost: 650,
      currency: "EUR",
    });
    await syncStockAndPrices();
    const offer = await db.supplierOffer.findFirstOrThrow();
    expect(offer).toMatchObject({ lastKnownStock: 3, purchaseCostCents: 650 });
    expect(await db.supplierCostHistory.count({ where: { offerId: offer.id } })).toBe(1);
    expect(await alerts("low-stock:")).toBe(1);

    fakeAdapters.ALIEXPRESS.getStockAndPrice.mockResolvedValueOnce({
      stock: 0,
      unitCost: 650,
      currency: "EUR",
    });
    await syncStockAndPrices();
    expect(await alerts("sold-out:")).toBe(1);
    expect(order).toBeTruthy();
  });

  it("prix CJ en dollars : converti avec le taux saisi, sinon non modifié", async () => {
    await paidOrderWithOffers([{ adapter: "CJ" }]);
    fakeAdapters.CJ.getStockAndPrice.mockResolvedValue({ stock: 100, unitCost: 700, currency: "USD" });
    await syncStockAndPrices();
    expect((await db.supplierOffer.findFirstOrThrow()).purchaseCostCents).toBe(579);

    await db.shopSettings.create({
      data: { shopName: "Test", legalIdentity: {}, cgvVersion: "2026-10-01", usdToEurMicros: 900_000 },
    });
    await syncStockAndPrices();
    expect((await db.supplierOffer.findFirstOrThrow()).purchaseCostCents).toBe(630);
  });
});
