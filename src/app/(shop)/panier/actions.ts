"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addItem, MAX_QUANTITY_PER_LINE, setQuantity } from "@/server/cart/cart-cookie";
import { findUsablePromo, readCartCookie, writeCartCookie } from "@/server/cart/cart";
import { db } from "@/server/db";
import { variantAvailability } from "@/server/catalog/availability";
import { checkRateLimit } from "@/server/security/ratelimit";

// Chaque action : rate limiting → validation Zod → relecture en base → écriture du cookie signé.

export type CartActionState = { ok: boolean; message: string } | null;

const variantIdSchema = z.string().min(1).max(64);
const quantitySchema = z.coerce.number().int().min(0).max(MAX_QUANTITY_PER_LINE);

const TOO_MANY = { ok: false, message: "Trop de tentatives, réessayez dans un instant." };

export async function addToCartAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  if (!(await checkRateLimit("cartUpdate"))) return TOO_MANY;

  const parsed = z
    .object({ variantId: variantIdSchema, quantity: quantitySchema.pipe(z.number().min(1)) })
    .safeParse({ variantId: formData.get("variantId"), quantity: formData.get("quantity") });
  if (!parsed.success) return { ok: false, message: "Choisissez une taille et une quantité valides." };

  const variant = await db.variant.findFirst({
    where: { id: parsed.data.variantId, active: true, product: { active: true } },
    include: { offers: true },
  });
  if (!variant || !variantAvailability(variant.offers).available) {
    return { ok: false, message: "Cette taille n'est plus disponible." };
  }

  const cart = await readCartCookie();
  await writeCartCookie(addItem(cart, variant.id, parsed.data.quantity));
  revalidatePath("/", "layout");
  return { ok: true, message: "Ajouté au panier." };
}

export async function updateQuantityAction(formData: FormData): Promise<void> {
  if (!(await checkRateLimit("cartUpdate"))) return;
  const parsed = z
    .object({ variantId: variantIdSchema, quantity: quantitySchema })
    .safeParse({ variantId: formData.get("variantId"), quantity: formData.get("quantity") });
  if (!parsed.success) return;

  const cart = await readCartCookie();
  await writeCartCookie(setQuantity(cart, parsed.data.variantId, parsed.data.quantity));
  revalidatePath("/", "layout");
}

export async function applyPromoAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  // Limite stricte : empêche de deviner des codes par force brute.
  if (!(await checkRateLimit("promoCode"))) return TOO_MANY;

  const parsed = z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/)
    .safeParse(formData.get("promoCode"));
  if (!parsed.success) return { ok: false, message: "Code invalide." };

  const promo = await findUsablePromo(parsed.data);
  if (!promo) return { ok: false, message: "Ce code n'existe pas ou n'est plus valable." };

  const cart = await readCartCookie();
  await writeCartCookie({ ...cart, promoCode: promo.code });
  revalidatePath("/", "layout");
  return { ok: true, message: `Code ${promo.code} appliqué.` };
}

export async function removePromoAction(): Promise<void> {
  const cart = await readCartCookie();
  await writeCartCookie({ v: 1, items: cart.items });
  revalidatePath("/", "layout");
}
