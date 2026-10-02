import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { metaPayload, normalizedHashes, tiktokPayload } from "@/server/marketing/payloads";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const event = {
  name: "Purchase" as const,
  eventId: "abc12345def",
  valueCents: 3480,
  contents: [{ id: "COUSSIN-M", name: "Coussin — M", quantity: 1, priceCents: 2990 }],
};

describe("messages envoyés aux régies", () => {
  it("email et téléphone normalisés puis hachés : jamais en clair", () => {
    const h = normalizedHashes({ email: "  Camille.Martin@Example.FR ", phone: "+33 6 12 34 56 78" });
    expect(h.email).toBe(sha("camille.martin@example.fr"));
    expect(h.phoneE164).toBe(sha("+33612345678"));
    expect(h.phoneDigits).toBe(sha("33612345678"));
  });

  it("TikTok : même event_id que le pixel, montant en euros, aucune donnée en clair", () => {
    const payload = tiktokPayload("CPIXEL", event, { ttp: "ttp-1", ip: "1.2.3.4" }, { email: "a@b.fr" });
    const data = payload.data[0]!;
    expect(data).toMatchObject({
      event: "Purchase",
      event_id: "abc12345def",
      properties: { currency: "EUR", value: 34.8 },
    });
    expect(data.user.email).toBe(sha("a@b.fr"));
    expect(JSON.stringify(payload)).not.toContain("a@b.fr");
  });

  it("Meta : même event_id, action_source website", () => {
    const payload = metaPayload(event, { fbp: "fb.1.123" }, { email: "a@b.fr" });
    expect(payload.data[0]).toMatchObject({
      event_name: "Purchase",
      event_id: "abc12345def",
      action_source: "website",
    });
    expect(payload.data[0]!.user_data.em).toEqual([sha("a@b.fr")]);
  });
});
