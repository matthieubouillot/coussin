import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { createPaidOrder, createStripeRefund, resetDatabase } from "./helpers";

vi.mock("@/server/stripe/stripe", async () => (await import("./helpers")).fakeStripeModule());

const { POST } = await import("@/app/api/webhooks/stripe/route");
const { cancelOrder, refundOrder, RefundError } = await import("@/server/orders/refunds");
const { anonymizeCustomer, exportCustomerData } = await import("@/server/gdpr/customers");
const { salesLedgerCsv } = await import("@/server/accounting/exports");

beforeEach(async () => {
  await resetDatabase();
  createStripeRefund.mockClear();
});

const ADMIN = "admin-test";

describe("remboursements", () => {
  it("partiel puis total : avoirs BTQ-AV continus, statuts journalisés", async () => {
    const order = await createPaidOrder(POST);

    const first = await refundOrder({
      orderId: order.id,
      amountCents: 1000,
      reason: "Geste commercial",
      adminId: ADMIN,
    });
    expect(first.creditNoteNumber).toBe("BTQ-AV-000001");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PARTIALLY_REFUNDED");

    const second = await refundOrder({
      orderId: order.id,
      amountCents: 2480,
      reason: "Rétractation",
      adminId: ADMIN,
    });
    expect(second.creditNoteNumber).toBe("BTQ-AV-000002");

    const after = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { statusEvents: { orderBy: { createdAt: "asc" } }, invoices: { orderBy: { number: "asc" } } },
    });
    expect(after.status).toBe("REFUNDED");
    expect(after.statusEvents.map((e) => e.toStatus)).toEqual([
      "PAID",
      "REFUND_REQUESTED",
      "PARTIALLY_REFUNDED",
      "REFUND_REQUESTED",
      "REFUNDED",
    ]);
    const creditNotes = after.invoices.filter((i) => i.type === "CREDIT_NOTE");
    expect(creditNotes.map((c) => c.totalCents)).toEqual([-1000, -2480]);
    expect(creditNotes.every((c) => c.pdfStorageKey?.startsWith("avoirs/"))).toBe(true);
    expect(createStripeRefund).toHaveBeenCalledTimes(2);
    expect(await db.emailLog.count({ where: { type: "REFUND" } })).toBe(2);
  });

  it("refuse de rembourser plus que le restant, sans appeler Stripe", async () => {
    const order = await createPaidOrder(POST);
    await expect(
      refundOrder({ orderId: order.id, amountCents: 3481, reason: "Trop", adminId: ADMIN }),
    ).rejects.toBeInstanceOf(RefundError);
    expect(createStripeRefund).not.toHaveBeenCalled();
    expect(await db.refund.count()).toBe(0);
  });

  it("échec Stripe : remboursement marqué FAILED, aucun avoir, statut inchangé", async () => {
    const order = await createPaidOrder(POST);
    createStripeRefund.mockRejectedValueOnce(new Error("card_declined"));
    await expect(
      refundOrder({ orderId: order.id, amountCents: 500, reason: "Test", adminId: ADMIN }),
    ).rejects.toBeInstanceOf(RefundError);
    expect((await db.refund.findFirstOrThrow()).status).toBe("FAILED");
    expect(await db.invoice.count({ where: { type: "CREDIT_NOTE" } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("annulation d'une commande payée : annulée puis intégralement remboursée", async () => {
    const order = await createPaidOrder(POST);
    await cancelOrder({ orderId: order.id, reason: "Rupture fournisseur", adminId: ADMIN });
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { refunds: true } });
    expect(after.status).toBe("REFUNDED");
    expect(after.refunds.map((r) => r.amountCents)).toEqual([3480]);
  });
});

describe("RGPD", () => {
  it("export puis anonymisation : données effacées, factures intactes", async () => {
    const order = await createPaidOrder(POST);
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { invoices: true } });
    await db.contactMessage.create({
      data: { email: paid.email, name: "Camille", body: "Bonjour, une question." },
    });

    const exported = await exportCustomerData(paid.customerId!);
    expect(exported.customer.email).toBe("client.test@example.fr");
    expect(exported.orders[0]?.shippingAddress).toContain("Lyon");
    expect(exported.contactMessages).toHaveLength(1);

    await anonymizeCustomer(paid.customerId!);
    const anonymized = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { invoices: true, customer: true },
    });
    expect(anonymized.email).toMatch(/^anonymise-.*@invalid\.invalid$/);
    expect(anonymized.shippingCity).toBeNull();
    expect(anonymized.phone).toBeNull();
    expect(anonymized.customer?.anonymizedAt).not.toBeNull();
    expect(await db.contactMessage.count()).toBe(0);
    // La facture (pièce comptable) est conservée à l'identique.
    expect(anonymized.invoices[0]?.customerSnapshot).toEqual(paid.invoices[0]?.customerSnapshot);
  });
});

describe("livre des recettes", () => {
  it("encaissement positif, remboursement négatif, total de la période", async () => {
    const order = await createPaidOrder(POST);
    await refundOrder({ orderId: order.id, amountCents: 1000, reason: "Geste", adminId: ADMIN });
    const csv = await salesLedgerCsv({
      start: new Date(Date.now() - 86_400_000),
      end: new Date(Date.now() + 86_400_000),
    });
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('"BTQ-000001"');
    expect(lines[1]).toContain(";34,80;");
    expect(lines[2]).toContain('"BTQ-AV-000001"');
    expect(lines[2]).toContain(";-10,00;");
    expect(lines[3]).toContain(";24,80;");
  });
});
