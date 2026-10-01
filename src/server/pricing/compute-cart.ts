import { applyBps } from "@/lib/money";

/**
 * Calcul du total d'un panier — fonction pure, seule source de vérité des montants.
 *
 * Elle ne reçoit que des données relues en base (prix, offres, codes promo) : rien de ce
 * que le navigateur envoie, hormis les identifiants de variantes et les quantités, n'y entre.
 */

export type PricingLine = { variantId: string; quantity: number; unitPriceCents: number };

export type PricingBundle = {
  id: string;
  name: string;
  kind: "QUANTITY" | "COMBO";
  minQuantity: number | null;
  comboVariantIds: string[];
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
};

export type PricingPromo = {
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minSubtotalCents: number | null;
};

export type PricingShipping = { priceCents: number; freeAboveCents: number | null };

export type PricingTax = { mode: "FRANCHISE_293B" | "STANDARD"; rateBps: number };

export type CartTotals = {
  subtotalCents: number;
  bundle: { id: string; name: string; discountCents: number } | null;
  promo: { code: string; discountCents: number } | null;
  /** Code saisi mais non applicable (ex. minimum non atteint) : on explique pourquoi au client. */
  promoRejection: "MIN_SUBTOTAL" | null;
  shippingCents: number;
  totalCents: number;
  /** Part de TVA incluse dans le total TTC (0 en franchise en base). */
  taxCents: number;
};

function bundleDiscount(bundle: PricingBundle, lines: PricingLine[], subtotal: number): number {
  if (bundle.kind === "QUANTITY") {
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    if (bundle.minQuantity === null || totalQuantity < bundle.minQuantity) return 0;
    return bundle.discountType === "PERCENT"
      ? applyBps(subtotal, bundle.discountValue)
      : bundle.discountValue;
  }

  // COMBO : la remise s'applique une fois par ensemble complet (ex. 2 M + 2 L = 2 combos).
  if (bundle.comboVariantIds.length === 0) return 0;
  const sets = Math.min(
    ...bundle.comboVariantIds.map((id) =>
      lines.filter((l) => l.variantId === id).reduce((sum, l) => sum + l.quantity, 0),
    ),
  );
  if (sets === 0) return 0;
  const comboValue = bundle.comboVariantIds.reduce(
    (sum, id) => sum + (lines.find((l) => l.variantId === id)?.unitPriceCents ?? 0),
    0,
  );
  const perSet =
    bundle.discountType === "PERCENT" ? applyBps(comboValue, bundle.discountValue) : bundle.discountValue;
  return perSet * sets;
}

export function computeCart(input: {
  lines: PricingLine[];
  bundles: PricingBundle[];
  promo: PricingPromo | null;
  shipping: PricingShipping;
  tax: PricingTax;
}): CartTotals {
  const subtotalCents = input.lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

  // Une seule offre par lot, la plus avantageuse pour le client (décision Q9).
  let bundle: CartTotals["bundle"] = null;
  for (const candidate of input.bundles) {
    const discount = Math.min(bundleDiscount(candidate, input.lines, subtotalCents), subtotalCents);
    if (discount > 0 && discount > (bundle?.discountCents ?? 0)) {
      bundle = { id: candidate.id, name: candidate.name, discountCents: discount };
    }
  }
  const afterBundle = subtotalCents - (bundle?.discountCents ?? 0);

  let promo: CartTotals["promo"] = null;
  let promoRejection: CartTotals["promoRejection"] = null;
  if (input.promo) {
    if (input.promo.minSubtotalCents !== null && afterBundle < input.promo.minSubtotalCents) {
      promoRejection = "MIN_SUBTOTAL";
    } else {
      const raw =
        input.promo.discountType === "PERCENT"
          ? applyBps(afterBundle, input.promo.discountValue)
          : input.promo.discountValue;
      const discountCents = Math.min(raw, afterBundle);
      if (discountCents > 0) promo = { code: input.promo.code, discountCents };
    }
  }
  const merchandiseCents = afterBundle - (promo?.discountCents ?? 0);

  // Le seuil de livraison gratuite s'apprécie sur le montant réellement payé pour les articles.
  const freeShipping =
    subtotalCents === 0 ||
    (input.shipping.freeAboveCents !== null && merchandiseCents >= input.shipping.freeAboveCents);
  const shippingCents = freeShipping ? 0 : input.shipping.priceCents;

  const totalCents = merchandiseCents + shippingCents;

  // Prix affichés TTC : la TVA est extraite du total, jamais ajoutée par-dessus.
  const taxCents =
    input.tax.mode === "STANDARD" && input.tax.rateBps > 0
      ? totalCents - Math.round((totalCents * 10_000) / (10_000 + input.tax.rateBps))
      : 0;

  return { subtotalCents, bundle, promo, promoRejection, shippingCents, totalCents, taxCents };
}
