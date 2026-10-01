import { describe, expect, it } from "vitest";
import { referencePriceCents } from "@/server/pricing/reference-price";

const day = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 86_400_000);
const now = day(0);

describe("referencePriceCents (prix barré légal)", () => {
  it("sans historique ou sans baisse : pas de prix barré", () => {
    expect(referencePriceCents([], now)).toBeNull();
    expect(referencePriceCents([{ priceCents: 2990, validFrom: day(-90) }], now)).toBeNull();
  });

  it("baisse réelle après un prix stable : le prix d'avant est la référence", () => {
    const history = [
      { priceCents: 3990, validFrom: day(-90) },
      { priceCents: 2990, validFrom: day(-2) },
    ];
    expect(referencePriceCents(history, now)).toBe(3990);
  });

  it("la référence est le plus bas prix des 30 jours précédant la baisse", () => {
    const history = [
      { priceCents: 3990, validFrom: day(-90) },
      { priceCents: 3490, validFrom: day(-20) }, // prix pratiqué dans la fenêtre
      { priceCents: 2990, validFrom: day(-2) },
    ];
    expect(referencePriceCents(history, now)).toBe(3490);
  });

  it("une hausse artificielle juste avant la « promo » ne permet pas de barrer un prix plus haut", () => {
    const history = [
      { priceCents: 2990, validFrom: day(-90) },
      { priceCents: 4990, validFrom: day(-10) }, // hausse éphémère
      { priceCents: 2990, validFrom: day(-1) },
    ];
    expect(referencePriceCents(history, now)).toBeNull();
  });

  it("historique trop court pour prouver le prix sur 30 jours : pas de prix barré", () => {
    const history = [
      { priceCents: 3990, validFrom: day(-10) },
      { priceCents: 2990, validFrom: day(-1) },
    ];
    expect(referencePriceCents(history, now)).toBeNull();
  });

  it("réduction de plus de 30 jours : le prix réduit est devenu le prix habituel", () => {
    const history = [
      { priceCents: 3990, validFrom: day(-200) },
      { priceCents: 2990, validFrom: day(-45) },
    ];
    expect(referencePriceCents(history, now)).toBeNull();
  });
});
