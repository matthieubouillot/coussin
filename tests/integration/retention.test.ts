import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { createPaidOrder, resetDatabase } from "./helpers";

vi.mock("@/server/stripe/stripe", async () => (await import("./helpers")).fakeStripeModule());
const { POST } = await import("@/app/api/webhooks/stripe/route");
const { applyRetention } = await import("@/server/gdpr/retention");

beforeEach(resetDatabase);

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

describe("durées de conservation", () => {
  it("supprime ce qui a dépassé sa durée, garde le reste", async () => {
    await db.contactMessage.createMany({
      data: [
        { email: "vieux@example.fr", name: "A", body: "Ancien message", createdAt: ago(400) },
        { email: "recent@example.fr", name: "B", body: "Message récent", createdAt: ago(10) },
      ],
    });
    await db.auditLog.createMany({
      data: [{ action: "x.vieux", createdAt: ago(400) }, { action: "x.recent" }],
    });
    await db.consentRecord.createMany({
      data: [
        { consentId: "c-ancien", choices: { ads: false }, policyVersion: "v", createdAt: ago(200) },
        { consentId: "c-recent", choices: { ads: true }, policyVersion: "v" },
      ],
    });

    const report = await applyRetention();
    expect(report).toMatchObject({ contactMessages: 1, auditLogs: 1, consentProofs: 1 });
    expect((await db.contactMessage.findMany()).map((m) => m.email)).toEqual(["recent@example.fr"]);
    expect((await db.auditLog.findMany()).map((a) => a.action)).toEqual(["x.recent"]);
  });

  it("client inactif depuis 3 ans : anonymisé, facture conservée telle quelle", async () => {
    const order = await createPaidOrder(POST);
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { invoices: true } });
    await db.customer.update({ where: { id: paid.customerId! }, data: { lastActivityAt: ago(3 * 366) } });

    expect((await applyRetention()).customersAnonymized).toBe(1);
    const after = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { invoices: true, customer: true },
    });
    expect(after.customer?.anonymizedAt).not.toBeNull();
    expect(after.shippingCity).toBeNull();
    expect(after.invoices[0]?.customerSnapshot).toEqual(paid.invoices[0]?.customerSnapshot);
  });
});
