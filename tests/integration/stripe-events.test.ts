import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import {
  completedEvent,
  createPaidOrder,
  createPendingOrder,
  resetDatabase,
  signedWebhookRequest,
} from "./helpers";

vi.mock("@/server/stripe/stripe", async () => (await import("./helpers")).fakeStripeModule());
const { POST } = await import("@/app/api/webhooks/stripe/route");

beforeEach(resetDatabase);

let n = 0;
const stripeEvent = (type: string, object: object) => ({
  id: `evt_ext_${Date.now()}_${++n}`,
  object: "event",
  type,
  created: Math.floor(Date.now() / 1000),
  data: { object },
});

describe("événements Stripe hors parcours d'achat", () => {
  it("remboursement fait dans le dashboard Stripe : avoir émis, livre des recettes juste, idempotent", async () => {
    const order = await createPaidOrder(POST);
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    const refund = {
      id: "re_dashboard_1",
      object: "refund",
      amount: 1000,
      status: "succeeded",
      payment_intent: paid.stripePaymentIntentId,
      metadata: {},
    };

    expect((await POST(signedWebhookRequest(stripeEvent("refund.created", refund)))).status).toBe(200);
    expect((await POST(signedWebhookRequest(stripeEvent("refund.updated", refund)))).status).toBe(200);

    const after = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { refunds: true, invoices: true },
    });
    expect(after.status).toBe("PARTIALLY_REFUNDED");
    expect(after.refunds.map((r) => [r.amountCents, r.status])).toEqual([[1000, "SUCCEEDED"]]);
    expect(after.invoices.filter((i) => i.type === "CREDIT_NOTE").map((i) => i.number)).toEqual([
      "BTQ-AV-000001",
    ]);
  });

  it("remboursement lancé depuis l'admin : l'événement Stripe correspondant est ignoré", async () => {
    const order = await createPaidOrder(POST);
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    const refund = {
      id: "re_admin_1",
      object: "refund",
      amount: 500,
      status: "succeeded",
      payment_intent: paid.stripePaymentIntentId,
      metadata: { refundId: "r1" },
    };
    await POST(signedWebhookRequest(stripeEvent("refund.created", refund)));
    expect(await db.refund.count()).toBe(0);
  });

  it("litige bancaire : note sur la commande et alerte immédiate", async () => {
    const order = await createPaidOrder(POST);
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    const dispute = {
      id: "dp_1",
      object: "dispute",
      amount: 3480,
      reason: "product_not_received",
      payment_intent: paid.stripePaymentIntentId,
      evidence_details: { due_by: Math.floor(Date.now() / 1000) + 7 * 86_400 },
    };
    expect((await POST(signedWebhookRequest(stripeEvent("charge.dispute.created", dispute)))).status).toBe(
      200,
    );
    expect((await db.orderNote.findFirstOrThrow({ where: { orderId: order.id } })).body).toContain(
      "LITIGE BANCAIRE",
    );
    expect(await db.emailLog.count({ where: { dedupKey: "admin:dispute:dp_1" } })).toBe(1);
  });

  it("code promo à sa dernière utilisation, payé deux fois : honoré et signalé", async () => {
    const promo = await db.promoCode.create({
      data: { code: "UNEFOIS", discountType: "FIXED", discountValue: 0, maxUses: 1 },
    });
    const a = await createPendingOrder({ promoCodeId: promo.id });
    const b = await createPendingOrder({ promoCodeId: promo.id });
    await POST(signedWebhookRequest(completedEvent(a)));
    await POST(signedWebhookRequest(completedEvent(b)));
    expect((await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).usedCount).toBe(2);
    expect(await db.orderNote.count({ where: { body: { contains: "au-delà de sa limite" } } })).toBe(1);
  });
});
