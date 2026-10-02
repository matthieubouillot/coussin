import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { completedEvent, createPendingOrder, resetDatabase, signedWebhookRequest } from "./helpers";

vi.mock("@/server/stripe/stripe", async () => (await import("./helpers")).fakeStripeModule());
const { POST } = await import("@/app/api/webhooks/stripe/route");

// Seuls les appels vers TikTok sont interceptés ; tout le reste (base, webhook) est réel.
const realFetch = globalThis.fetch;
let tiktokCalls: { body: string }[] = [];

beforeEach(async () => {
  await resetDatabase();
  tiktokCalls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("business-api.tiktok.com")) {
      tiktokCalls.push({ body: String(init?.body) });
      return new Response(JSON.stringify({ code: 0 }), { status: 200 });
    }
    return realFetch(input, init);
  });
});
afterEach(() => vi.restoreAllMocks());

async function orderWithConsent(adsConsent: boolean) {
  const order = await createPendingOrder();
  return db.order.update({
    where: { id: order.id },
    data: {
      adsConsent,
      marketingEventId: "evtachat1234567890",
      marketingContext: adsConsent
        ? { ttp: "ttp-123", ttclid: "clic-456", ip: "203.0.113.7", userAgent: "Mozilla/5.0" }
        : undefined,
    },
  });
}

describe("événement d'achat côté serveur", () => {
  it("avec consentement : envoyé une fois, données hachées, contexte effacé ensuite", async () => {
    const order = await orderWithConsent(true);
    const event = completedEvent(order);
    await POST(signedWebhookRequest(event));
    await POST(signedWebhookRequest(event)); // rejeu Stripe

    expect(tiktokCalls).toHaveLength(1);
    const payload = JSON.parse(tiktokCalls[0]!.body);
    expect(payload.data[0]).toMatchObject({
      event: "Purchase",
      event_id: "evtachat1234567890",
      user: { ttp: "ttp-123", ttclid: "clic-456" },
    });
    expect(tiktokCalls[0]!.body).not.toContain("client.test@example.fr");
    expect(payload.data[0].user.email).toMatch(/^[a-f0-9]{64}$/);

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.marketingContext).toBeNull();
  });

  it("sans consentement : rien n'est envoyé aux régies", async () => {
    const order = await orderWithConsent(false);
    await POST(signedWebhookRequest(completedEvent(order)));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect(tiktokCalls).toHaveLength(0);
  });
});
