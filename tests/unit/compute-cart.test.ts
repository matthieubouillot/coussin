import { describe, expect, it } from "vitest";
import { computeCart, type PricingBundle } from "@/server/pricing/compute-cart";

const M = { variantId: "m", unitPriceCents: 2990 };
const L = { variantId: "l", unitPriceCents: 4490 };
const shipping = { priceCents: 490, freeAboveCents: 4900 };
const franchise = { mode: "FRANCHISE_293B" as const, rateBps: 0 };

const lot2: PricingBundle = {
  id: "b1",
  name: "Lot de 2",
  kind: "QUANTITY",
  minQuantity: 2,
  comboVariantIds: [],
  discountType: "PERCENT",
  discountValue: 1000,
};
const duo: PricingBundle = {
  id: "b2",
  name: "Duo M + L",
  kind: "COMBO",
  minQuantity: null,
  comboVariantIds: ["m", "l"],
  discountType: "FIXED",
  discountValue: 500,
};

describe("computeCart", () => {
  it("un coussin M : 29,90 € + 4,90 € de livraison", () => {
    const t = computeCart({
      lines: [{ ...M, quantity: 1 }],
      bundles: [],
      promo: null,
      shipping,
      tax: franchise,
    });
    expect(t).toMatchObject({ subtotalCents: 2990, shippingCents: 490, totalCents: 3480, taxCents: 0 });
  });

  it("livraison offerte dès 49 € d'articles", () => {
    const t = computeCart({
      lines: [{ ...M, quantity: 2 }],
      bundles: [],
      promo: null,
      shipping,
      tax: franchise,
    });
    expect(t.subtotalCents).toBe(5980);
    expect(t.shippingCents).toBe(0);
  });

  it("le seuil de livraison gratuite s'apprécie après remises", () => {
    // 2 × 29,90 = 59,80 − code 15 € = 44,80 < 49 → livraison payante.
    const t = computeCart({
      lines: [{ ...M, quantity: 2 }],
      bundles: [],
      shipping,
      tax: franchise,
      promo: { code: "X", discountType: "FIXED", discountValue: 1500, minSubtotalCents: null },
    });
    expect(t.shippingCents).toBe(490);
    expect(t.totalCents).toBe(5980 - 1500 + 490);
  });

  it("applique une seule offre par lot, la plus avantageuse", () => {
    // M + L = 74,80 € : lot 2 → −7,48 € ; duo → −5 € ⇒ le lot de 2 gagne.
    const t = computeCart({
      lines: [
        { ...M, quantity: 1 },
        { ...L, quantity: 1 },
      ],
      bundles: [duo, lot2],
      promo: null,
      shipping,
      tax: franchise,
    });
    expect(t.bundle).toEqual({ id: "b1", name: "Lot de 2", discountCents: 748 });
  });

  it("le duo s'applique une fois par ensemble complet", () => {
    const t = computeCart({
      lines: [
        { ...M, quantity: 2 },
        { ...L, quantity: 3 },
      ],
      bundles: [duo],
      promo: null,
      shipping,
      tax: franchise,
    });
    expect(t.bundle?.discountCents).toBe(1000);
  });

  it("n'applique pas une offre dont la condition n'est pas remplie", () => {
    const t = computeCart({
      lines: [{ ...M, quantity: 1 }],
      bundles: [lot2, duo],
      promo: null,
      shipping,
      tax: franchise,
    });
    expect(t.bundle).toBeNull();
  });

  it("refuse un code promo dont le minimum n'est pas atteint, en le signalant", () => {
    const t = computeCart({
      lines: [{ ...M, quantity: 1 }],
      bundles: [],
      shipping,
      tax: franchise,
      promo: { code: "MIN50", discountType: "PERCENT", discountValue: 1000, minSubtotalCents: 5000 },
    });
    expect(t.promo).toBeNull();
    expect(t.promoRejection).toBe("MIN_SUBTOTAL");
  });

  it("une remise ne rend jamais le total des articles négatif", () => {
    const t = computeCart({
      lines: [{ ...M, quantity: 1 }],
      bundles: [],
      shipping,
      tax: franchise,
      promo: { code: "GROS", discountType: "FIXED", discountValue: 99_999, minSubtotalCents: null },
    });
    expect(t.promo?.discountCents).toBe(2990);
    expect(t.totalCents).toBe(490);
  });

  it("panier vide : total nul, pas de frais de port", () => {
    const t = computeCart({ lines: [], bundles: [lot2], promo: null, shipping, tax: franchise });
    expect(t.totalCents).toBe(0);
  });

  it("extrait la TVA d'un prix TTC quand la TVA est activée", () => {
    const t = computeCart({
      lines: [{ ...M, quantity: 2 }],
      bundles: [],
      promo: null,
      shipping,
      tax: { mode: "STANDARD", rateBps: 2000 },
    });
    // 59,80 TTC → HT 49,83 → TVA 9,97
    expect(t.taxCents).toBe(997);
    expect(t.totalCents).toBe(5980);
  });
});
