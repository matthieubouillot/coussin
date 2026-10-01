import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import {
  CART_COOKIE_NAME,
  decodeCart,
  encodeCart,
  EMPTY_CART,
  type CartCookie,
} from "@/server/cart/cart-cookie";
import { getActiveBundles, getActiveShippingRate } from "@/server/catalog/catalog";
import { variantAvailability, type Availability } from "@/server/catalog/availability";
import { computeCart, type CartTotals, type PricingPromo } from "@/server/pricing/compute-cart";
import { cartCookieSecret } from "@/server/secrets";
import { getShopConfig } from "@/server/settings/settings";

const CART_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function readCartCookie(): Promise<CartCookie> {
  const store = await cookies();
  return decodeCart(store.get(CART_COOKIE_NAME)?.value, cartCookieSecret());
}

export async function writeCartCookie(cart: CartCookie): Promise<void> {
  const store = await cookies();
  if (cart.items.length === 0 && !cart.promoCode) {
    store.delete(CART_COOKIE_NAME);
    return;
  }
  store.set(CART_COOKIE_NAME, encodeCart(cart, cartCookieSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_MAX_AGE_SECONDS,
  });
}

export async function clearCart(): Promise<void> {
  await writeCartCookie(EMPTY_CART);
}

/** Code promo utilisable maintenant, ou null. Les codes sont comparés en majuscules. */
export async function findUsablePromo(rawCode: string, now = new Date()): Promise<PricingPromo | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) return null;
  if (promo.startsAt && promo.startsAt > now) return null;
  if (promo.expiresAt && promo.expiresAt <= now) return null;
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return null;
  return {
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    minSubtotalCents: promo.minSubtotalCents,
  };
}

export type CartLineView = {
  variantId: string;
  productName: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  availability: Availability;
};

export type CartView = {
  lines: CartLineView[];
  totals: CartTotals;
  promoCodeEntered: string | null;
  /** Lignes retirées car le produit n'existe plus ou est en rupture. */
  removedCount: number;
  itemCount: number;
};

/**
 * Panier tel qu'affiché et tel qu'il sera facturé : tout est relu en base et recalculé ici.
 * Les lignes devenues invalides (variante supprimée, rupture) sont écartées.
 */
export async function getCartView(cart?: CartCookie): Promise<CartView> {
  const current = cart ?? (await readCartCookie());
  const variantIds = current.items.map((i) => i.variantId);

  const [variants, bundles, shipping, config, promo] = await Promise.all([
    variantIds.length
      ? db.variant.findMany({
          where: { id: { in: variantIds }, active: true, product: { active: true } },
          include: { product: { select: { name: true } }, offers: true },
        })
      : Promise.resolve([]),
    getActiveBundles(),
    getActiveShippingRate(),
    getShopConfig(),
    current.promoCode ? findUsablePromo(current.promoCode) : Promise.resolve(null),
  ]);

  const lines: CartLineView[] = [];
  for (const item of current.items) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant) continue;
    const availability = variantAvailability(variant.offers);
    if (!availability.available) continue;
    lines.push({
      variantId: variant.id,
      productName: variant.product.name,
      label: variant.label,
      quantity: item.quantity,
      unitPriceCents: variant.priceCents,
      lineTotalCents: variant.priceCents * item.quantity,
      availability,
    });
  }

  const totals = computeCart({
    lines: lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
    })),
    bundles,
    promo,
    // Sans tarif configuré, on n'invente pas de frais : le paiement sera bloqué en phase 3.
    shipping: shipping ?? { priceCents: 0, freeAboveCents: null },
    tax: { mode: config.taxMode, rateBps: config.taxRateBps },
  });

  return {
    lines,
    totals,
    promoCodeEntered: current.promoCode ?? null,
    removedCount: current.items.length - lines.length,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}
