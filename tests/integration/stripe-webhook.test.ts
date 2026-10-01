import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import {
  completedEvent,
  createPendingOrder,
  resetDatabase,
  retrievePaymentIntent,
  signedWebhookRequest,
} from "./helpers";

// Seul l'appel réseau sortant vers Stripe est simulé ; la vérification de signature est réelle.
vi.mock("@/server/stripe/stripe", async () => {
  const { default: Stripe } = await import("stripe");
  const real = new Stripe("sk_test_integration_dummy");
  const { retrievePaymentIntent } = await import("./helpers");
  const client = { webhooks: real.webhooks, paymentIntents: { retrieve: retrievePaymentIntent } };
  return { stripe: () => client, isStripeConfigured: () => true, STRIPE_API_VERSION: "2026-09-30.endive" };
});

const { POST } = await import("@/app/api/webhooks/stripe/route");

beforeEach(async () => {
  await resetDatabase();
  retrievePaymentIntent.mockClear();
});

describe("webhook Stripe", () => {
  it("refuse un événement non signé ou mal signé", async () => {
    const order = await createPendingOrder();
    const unsigned = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify(completedEvent(order)),
    });
    expect((await POST(unsigned)).status).toBe(400);
    expect((await POST(signedWebhookRequest(completedEvent(order), "whsec_mauvais_secret"))).status).toBe(
      400,
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("paiement confirmé : commande PAID, client, facture BTQ-000001 avec PDF, email, journal", async () => {
    const promo = await db.promoCode.create({
      data: { code: "NOEL", discountType: "FIXED", discountValue: 0 },
    });
    const order = await createPendingOrder({ promoCodeId: promo.id });

    const response = await POST(signedWebhookRequest(completedEvent(order)));
    expect(response.status).toBe(200);

    const paid = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { invoices: true, statusEvents: true, customer: true, emails: true },
    });
    expect(paid.status).toBe("PAID");
    expect(paid.email).toBe("client.test@example.fr");
    expect(paid.shippingCity).toBe("Lyon");
    expect(paid.paymentMethodType).toBe("apple_pay");
    expect(paid.customer?.firstName).toBe("Camille");
    expect(paid.statusEvents.map((e) => [e.fromStatus, e.toStatus, e.actorType])).toEqual([
      ["PENDING_PAYMENT", "PAID", "WEBHOOK"],
    ]);

    expect(paid.invoices).toHaveLength(1);
    const invoice = paid.invoices[0]!;
    expect(invoice.number).toBe("BTQ-000001");
    expect(invoice.totalCents).toBe(3480);
    expect(invoice.legalMention).toBe("TVA non applicable, art. 293 B du CGI");
    expect(invoice.pdfStorageKey).toBe(`factures/BTQ-000001-${invoice.id}.pdf`);
    expect(invoice.pdfSha256).toMatch(/^[a-f0-9]{64}$/);

    expect(paid.emails.map((e) => e.type)).toEqual(["ORDER_CONFIRMATION"]);
    expect((await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).usedCount).toBe(1);
  });

  it("idempotence : le même événement reçu deux fois ne crée ni deuxième facture ni deuxième email", async () => {
    const order = await createPendingOrder();
    const event = completedEvent(order);
    expect((await POST(signedWebhookRequest(event))).status).toBe(200);
    expect((await POST(signedWebhookRequest(event))).status).toBe(200);

    expect(await db.invoice.count()).toBe(1);
    expect(await db.emailLog.count({ where: { type: "ORDER_CONFIRMATION" } })).toBe(1);
    expect(await db.orderStatusEvent.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("un second événement différent pour la même session ne repasse pas la commande", async () => {
    const order = await createPendingOrder();
    await POST(signedWebhookRequest(completedEvent(order)));
    await POST(signedWebhookRequest(completedEvent(order)));
    expect(await db.invoice.count()).toBe(1);
  });

  it("écart de montant : commande payée mais facture non émise, note interne", async () => {
    const order = await createPendingOrder();
    expect((await POST(signedWebhookRequest(completedEvent(order, 100)))).status).toBe(200);
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { notes: true } });
    expect(after.status).toBe("PAID");
    expect(await db.invoice.count()).toBe(0);
    expect(after.notes[0]?.body).toContain("ÉCART DE MONTANT");
    expect(await db.emailLog.count({ where: { type: "ORDER_CONFIRMATION" } })).toBe(0);
  });

  it("session expirée : commande annulée", async () => {
    const order = await createPendingOrder();
    const event = { ...completedEvent(order), type: "checkout.session.expired" };
    expect((await POST(signedWebhookRequest(event))).status).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });

  it("numérotation sans trou, même avec des paiements simultanés", async () => {
    const orders = await Promise.all(Array.from({ length: 5 }, () => createPendingOrder()));
    const responses = await Promise.all(orders.map((o) => POST(signedWebhookRequest(completedEvent(o)))));
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const numbers = (await db.invoice.findMany({ select: { number: true } })).map((i) => i.number).sort();
    expect(numbers).toEqual(["BTQ-000001", "BTQ-000002", "BTQ-000003", "BTQ-000004", "BTQ-000005"]);
  });
});

describe("immuabilité des factures (trigger SQL)", () => {
  it("interdit de modifier ou de supprimer une facture émise", async () => {
    const order = await createPendingOrder();
    await POST(signedWebhookRequest(completedEvent(order)));
    const invoice = await db.invoice.findFirstOrThrow();

    await expect(db.invoice.update({ where: { id: invoice.id }, data: { totalCents: 1 } })).rejects.toThrow(
      /modification interdite/,
    );
    await expect(
      db.invoice.update({ where: { id: invoice.id }, data: { pdfStorageKey: "autre.pdf" } }),
    ).rejects.toThrow(/ne peut pas être remplacé/);
    await expect(db.invoice.delete({ where: { id: invoice.id } })).rejects.toThrow(/suppression interdite/);
  });
});
