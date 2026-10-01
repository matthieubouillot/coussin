import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEvent, scrubText } from "@/lib/sentry/options";

describe("masquage des données personnelles pour Sentry", () => {
  it("masque emails et téléphones", () => {
    expect(scrubText("client jean.dupont@example.fr / 06 12 34 56 78")).toBe("client [email] / [téléphone]");
    expect(scrubText("+33612345678")).toBe("[téléphone]");
  });

  it("retire utilisateur, cookies, corps et paramètres de requête", () => {
    const event = {
      type: undefined,
      user: { email: "a@b.fr" },
      request: { url: "https://x.fr/suivi?email=a@b.fr", cookies: { s: "1" }, data: "{}", query_string: "q" },
      exception: { values: [{ value: "Échec pour a@b.fr" }] },
    } as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.url).toBe("https://x.fr/suivi?email=[email]");
    expect(scrubbed.exception?.values?.[0]?.value).toBe("Échec pour [email]");
  });
});
