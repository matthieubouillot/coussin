import { describe, expect, it } from "vitest";
import { buildShippingAddress, normalizeFrenchPhone, toPlainLatin } from "@/server/fulfillment/address";
import {
  marginBps,
  MAX_ATTEMPTS,
  nextCandidate,
  nextRetryAt,
  usdCentsToEurCents,
} from "@/server/fulfillment/policy";

describe("adresses pour les fournisseurs", () => {
  it("translittère en latin sans accents", () => {
    expect(toPlainLatin("Hélène Lefèvre-Cœur, 3 rue de l’Église")).toBe(
      "Helene Lefevre-Coeur, 3 rue de l'Eglise",
    );
    expect(toPlainLatin("Straße  Ærø — bât. B")).toBe("Strasse AEro - bat. B");
  });

  it("normalise les téléphones français", () => {
    expect(normalizeFrenchPhone("06 12 34 56 78")).toBe("+33612345678");
    expect(normalizeFrenchPhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizeFrenchPhone("0033612345678")).toBe("+33612345678");
    expect(normalizeFrenchPhone("12345")).toBeNull();
  });

  it("refuse une adresse incomplète", () => {
    const base = {
      shippingName: "A",
      shippingLine1: "1 rue",
      shippingLine2: null,
      shippingPostalCode: "69001",
      shippingCity: "Lyon",
      phone: "0612345678",
    };
    expect(buildShippingAddress(base)?.phone).toBe("+33612345678");
    expect(buildShippingAddress({ ...base, phone: null })).toBeNull();
  });
});

describe("réessais et bascule", () => {
  it("1 essai + 5 réessais : 1 min, 5 min, 15 min, 1 h, 4 h, puis plus rien", () => {
    const now = 0;
    expect([1, 2, 3, 4, 5].map((n) => nextRetryAt(n, now)!.getTime())).toEqual([
      60_000, 300_000, 900_000, 3_600_000, 14_400_000,
    ]);
    expect(nextRetryAt(6, now)).toBeNull();
    expect(MAX_ATTEMPTS).toBe(6);
  });

  it("choisit l'offre suivante par priorité, hors échecs, ruptures et offres inactives", () => {
    const offers = [
      { id: "a", priority: 1, active: true, lastKnownStock: 5 },
      { id: "b", priority: 2, active: true, lastKnownStock: 0 },
      { id: "c", priority: 3, active: false, lastKnownStock: 9 },
      { id: "d", priority: 4, active: true, lastKnownStock: null },
    ];
    expect(nextCandidate(offers, new Set())?.id).toBe("a");
    expect(nextCandidate(offers, new Set(["a"]))?.id).toBe("d");
    expect(nextCandidate(offers, new Set(["a", "d"]))).toBeNull();
  });
});

describe("marge et devises", () => {
  it("calcule la marge en points de base", () => {
    // 29,90 € de vente, 5,79 € d'achat, 2,00 € de port → 73,9 %
    expect(marginBps(2990, 579, 200)).toBe(7395);
  });

  it("convertit les coûts CJ en euros avec le taux saisi", () => {
    expect(usdCentsToEurCents(650, 920_000)).toBe(598);
  });
});
