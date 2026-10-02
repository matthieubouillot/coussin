"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { requireAdmin } from "@/server/auth/require-admin";
import { productContentSchema, sizeGuideSchema } from "@/server/catalog/product-content";
import { db } from "@/server/db";

export type ActionState = { ok: boolean; message: string } | null;

const id = z.string().min(1).max(64);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const euros = z
  .string()
  .trim()
  .regex(/^\d{1,6}([.,]\d{1,2})?$/, "Montant invalide (ex. 29,90)")
  .transform((v) => Math.round(Number(v.replace(",", ".")) * 100));
const jsonText = <T extends z.ZodType>(schema: T) =>
  z.string().transform((text, ctx) => {
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data as z.infer<T>;
      ctx.addIssue({
        code: "custom",
        message: `Structure invalide : ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`,
      });
    } catch {
      ctx.addIssue({ code: "custom", message: "JSON invalide" });
    }
    return z.NEVER;
  });

function done(message: string): ActionState {
  revalidatePath("/", "layout");
  return { ok: true, message };
}
const invalid = (error: z.ZodError): ActionState => ({
  ok: false,
  message: error.issues[0]?.message ?? "Saisie invalide.",
});

export async function saveProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      id,
      name: z.string().trim().min(3).max(120),
      tagline: z.string().trim().min(3).max(200),
      packageContents: z.string().trim().min(1).max(500),
      textileComposition: optionalText(500),
      careInstructions: optionalText(2000),
      sortingInstructions: optionalText(2000),
      manufacturerName: optionalText(200),
      manufacturerAddress: optionalText(500),
      manufacturerContact: optionalText(200),
      euResponsibleName: optionalText(200),
      euResponsibleAddress: optionalText(500),
      euResponsibleContact: optionalText(200),
      productReference: optionalText(100),
      safetyWarnings: optionalText(3000),
      defaultAdapter: z.enum(["ALIEXPRESS", "CJ", "MANUAL"]),
      active: z.boolean(),
      contentBlocks: jsonText(productContentSchema),
      sizeGuide: jsonText(sizeGuideSchema),
    })
    .safeParse({ ...Object.fromEntries(formData), active: formData.get("active") === "on" });
  if (!parsed.success) return invalid(parsed.error);

  const { id: productId, ...data } = parsed.data;
  await db.product.update({ where: { id: productId }, data });
  await audit("product.update", { actorId: admin.id, targetType: "product", targetId: productId });
  return done("Produit enregistré.");
}

export async function saveVariantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      id,
      label: z.string().trim().min(1).max(80),
      widthCm: z.coerce.number().int().min(1).max(500),
      lengthCm: z.coerce.number().int().min(1).max(500),
      recommendedFor: z.string().trim().min(1).max(200),
      price: euros,
      position: z.coerce.number().int().min(0).max(100),
      active: z.boolean(),
      showReferencePrice: z.boolean(),
    })
    .safeParse({
      ...Object.fromEntries(formData),
      active: formData.get("active") === "on",
      showReferencePrice: formData.get("showReferencePrice") === "on",
    });
  if (!parsed.success) return invalid(parsed.error);

  const { id: variantId, price, ...data } = parsed.data;
  await db.$transaction(async (tx) => {
    const before = await tx.variant.findUniqueOrThrow({
      where: { id: variantId },
      select: { priceCents: true },
    });
    await tx.variant.update({ where: { id: variantId }, data: { ...data, priceCents: price } });
    // Chaque changement de prix est historisé : c'est la preuve du prix de référence (prix barré).
    if (before.priceCents !== price)
      await tx.salePriceHistory.create({ data: { variantId, priceCents: price } });
  });
  await audit("variant.update", {
    actorId: admin.id,
    targetType: "variant",
    targetId: variantId,
    metadata: { priceCents: price },
  });
  return done("Taille enregistrée.");
}

export async function createVariantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      productId: id,
      sku: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{2,40}$/, "SKU : lettres, chiffres, tirets"),
      label: z.string().trim().min(1).max(80),
      widthCm: z.coerce.number().int().min(1).max(500),
      lengthCm: z.coerce.number().int().min(1).max(500),
      recommendedFor: z.string().trim().min(1).max(200),
      price: euros,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { price, ...data } = parsed.data;
  const count = await db.variant.count({ where: { productId: data.productId } });
  const variant = await db.variant.create({
    data: {
      ...data,
      priceCents: price,
      position: count + 1,
      priceHistory: { create: { priceCents: price } },
    },
  });
  await audit("variant.create", { actorId: admin.id, targetType: "variant", targetId: variant.id });
  return done("Taille ajoutée. Pensez à lui associer au moins une offre fournisseur.");
}

const offerFields = {
  adapter: z.enum(["ALIEXPRESS", "CJ", "MANUAL"]),
  supplierName: z.string().trim().min(1).max(100),
  externalProductId: optionalText(100),
  externalSkuId: optionalText(100),
  externalUrl: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === "" ? null : v))
    .pipe(z.url({ protocol: /^https$/ }).nullable()),
  priority: z.coerce.number().int().min(1).max(20),
  purchaseCost: euros,
  shippingCost: euros,
  deliveryDaysMin: z.coerce.number().int().min(1).max(90),
  deliveryDaysMax: z.coerce.number().int().min(1).max(90),
  active: z.boolean(),
};

export async function saveOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ offerId: z.string().max(64).optional(), variantId: id, ...offerFields })
    .refine((o) => o.deliveryDaysMax >= o.deliveryDaysMin, "Le délai maximum doit être ≥ au délai minimum")
    .safeParse({
      ...Object.fromEntries(formData),
      offerId: formData.get("offerId") || undefined,
      active: formData.get("active") === "on",
    });
  if (!parsed.success) return invalid(parsed.error);

  const { offerId, purchaseCost, shippingCost, variantId, ...rest } = parsed.data;
  const data = { ...rest, purchaseCostCents: purchaseCost, shippingCostCents: shippingCost };
  try {
    const offer = await db.$transaction(async (tx) => {
      const saved = offerId
        ? await tx.supplierOffer.update({ where: { id: offerId }, data })
        : await tx.supplierOffer.create({ data: { ...data, variantId } });
      await tx.supplierCostHistory.create({
        data: {
          offerId: saved.id,
          purchaseCostCents: purchaseCost,
          shippingCostCents: shippingCost,
          stock: saved.lastKnownStock,
        },
      });
      return saved;
    });
    await audit(offerId ? "offer.update" : "offer.create", {
      actorId: admin.id,
      targetType: "supplierOffer",
      targetId: offer.id,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { ok: false, message: "Une autre offre de cette taille a déjà cette priorité." };
    }
    throw error;
  }
  return done("Offre fournisseur enregistrée.");
}

export async function deleteOfferAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const offerId = id.safeParse(formData.get("offerId"));
  if (!offerId.success) return;
  // Une offre déjà utilisée par une commande est désactivée plutôt que supprimée (historique).
  const used = await db.supplierOrder.count({ where: { offerId: offerId.data } });
  if (used > 0) await db.supplierOffer.update({ where: { id: offerId.data }, data: { active: false } });
  else {
    await db.supplierCostHistory.deleteMany({ where: { offerId: offerId.data } });
    await db.supplierOffer.delete({ where: { id: offerId.data } });
  }
  await audit("offer.delete", { actorId: admin.id, targetType: "supplierOffer", targetId: offerId.data });
  revalidatePath("/", "layout");
}

export async function saveMediaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      mediaId: id,
      alt: z.string().trim().min(3).max(200),
      position: z.coerce.number().int().min(0).max(100),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  await db.productMedia.update({
    where: { id: parsed.data.mediaId },
    data: { alt: parsed.data.alt, position: parsed.data.position },
  });
  await audit("media.update", { actorId: admin.id, targetType: "media", targetId: parsed.data.mediaId });
  return done("Média enregistré.");
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const mediaId = id.safeParse(formData.get("mediaId"));
  if (!mediaId.success) return;
  await db.productMedia.delete({ where: { id: mediaId.data } });
  await audit("media.delete", { actorId: admin.id, targetType: "media", targetId: mediaId.data });
  revalidatePath("/", "layout");
}

/** Enregistre un média déjà envoyé sur Vercel Blob (l'URL doit provenir de notre stockage). */
export async function registerMediaAction(input: {
  productId: string;
  url: string;
  kind: "IMAGE" | "VIDEO";
  width: number;
  height: number;
  alt: string;
}): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      productId: id,
      url: z
        .url({ protocol: /^https$/ })
        .refine(
          (u) => new URL(u).hostname.endsWith(".public.blob.vercel-storage.com"),
          "URL de stockage inattendue",
        ),
      kind: z.enum(["IMAGE", "VIDEO"]),
      width: z.int().min(1).max(10_000),
      height: z.int().min(1).max(10_000),
      alt: z.string().trim().min(3).max(200),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { productId, url, ...rest } = parsed.data;
  const position = await db.productMedia.count({ where: { productId } });
  const media = await db.productMedia.create({ data: { productId, blobUrl: url, position, ...rest } });
  await audit("media.create", { actorId: admin.id, targetType: "media", targetId: media.id });
  return done("Média ajouté.");
}
