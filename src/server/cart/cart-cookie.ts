import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Panier persistant dans un cookie signé (HMAC-SHA256).
 *
 * Le cookie ne contient que des identifiants de variantes, des quantités et le code promo saisi :
 * jamais de prix. Il est HttpOnly ; la signature empêche de le fabriquer, et de toute façon tout
 * est revalidé et recalculé côté serveur à chaque lecture.
 */

export const CART_COOKIE_NAME = "panier";
export const MAX_QUANTITY_PER_LINE = 10;
export const MAX_LINES = 10;

const cartSchema = z.object({
  v: z.literal(1),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1).max(64),
        quantity: z.int().min(1).max(MAX_QUANTITY_PER_LINE),
      }),
    )
    .max(MAX_LINES),
  promoCode: z.string().max(40).optional(),
});

export type CartCookie = z.infer<typeof cartSchema>;

export const EMPTY_CART: CartCookie = { v: 1, items: [] };

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeCart(cart: CartCookie, secret: string): string {
  const payload = Buffer.from(JSON.stringify(cart)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Toute valeur absente, altérée ou invalide donne un panier vide (jamais d'erreur visible). */
export function decodeCart(raw: string | undefined, secret: string): CartCookie {
  if (!raw) return EMPTY_CART;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return EMPTY_CART;

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return EMPTY_CART;

  try {
    const parsed = cartSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

/** Ajoute ou cumule une ligne, en respectant les plafonds. */
export function addItem(cart: CartCookie, variantId: string, quantity: number): CartCookie {
  const existing = cart.items.find((i) => i.variantId === variantId);
  if (existing) {
    return setQuantity(cart, variantId, existing.quantity + quantity);
  }
  if (cart.items.length >= MAX_LINES) return cart;
  return {
    ...cart,
    items: [...cart.items, { variantId, quantity: Math.min(Math.max(quantity, 1), MAX_QUANTITY_PER_LINE) }],
  };
}

/** Quantité 0 = suppression de la ligne. */
export function setQuantity(cart: CartCookie, variantId: string, quantity: number): CartCookie {
  const clamped = Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY_PER_LINE);
  return {
    ...cart,
    items:
      clamped === 0
        ? cart.items.filter((i) => i.variantId !== variantId)
        : cart.items.map((i) => (i.variantId === variantId ? { ...i, quantity: clamped } : i)),
  };
}
