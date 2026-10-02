import { describe, expect, it } from "vitest";
import { CONSENT_MAX_AGE_SECONDS, CONSENT_POLICY_VERSION, hasConsent } from "@/lib/consent";
import { parseConsentCookie } from "@/lib/consent-schema";

const valid = (at: number, ads = true) =>
  JSON.stringify({ v: CONSENT_POLICY_VERSION, id: "abcdefgh-1234", choices: { ads }, at });

describe("consentement cookies", () => {
  const now = Date.now();

  it("sans cookie : aucun consentement (l'absence de choix vaut refus)", () => {
    expect(parseConsentCookie(undefined, now)).toBeNull();
    expect(hasConsent(null, "ads")).toBe(false);
  });

  it("lit un choix valide", () => {
    expect(hasConsent(parseConsentCookie(valid(now), now), "ads")).toBe(true);
    expect(hasConsent(parseConsentCookie(valid(now, false), now), "ads")).toBe(false);
  });

  it("expire après 6 mois", () => {
    const old = now - (CONSENT_MAX_AGE_SECONDS + 60) * 1000;
    expect(parseConsentCookie(valid(old), now)).toBeNull();
  });

  it("ignore une ancienne version de politique ou un contenu invalide", () => {
    expect(
      parseConsentCookie(
        JSON.stringify({ v: "2020-01-01", id: "abcdefgh", choices: { ads: true }, at: now }),
        now,
      ),
    ).toBeNull();
    expect(parseConsentCookie("{pas du json", now)).toBeNull();
  });
});
