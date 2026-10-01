import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { variantAvailability, type Availability } from "@/server/catalog/availability";
import { productContentSchema, sizeGuideSchema } from "@/server/catalog/product-content";
import { referencePriceCents } from "@/server/pricing/reference-price";

export type CatalogVariant = {
  id: string;
  sku: string;
  label: string;
  widthCm: number;
  lengthCm: number;
  recommendedFor: string;
  priceCents: number;
  /** Prix barré, uniquement s'il est légalement justifié (voir reference-price.ts). */
  referencePriceCents: number | null;
  availability: Availability;
};

/**
 * Charge le produit vendu (boutique « one-product » : le premier produit actif)
 * avec tout ce que la page produit affiche, déjà validé et calculé.
 */
export const getMainProduct = cache(async () => {
  const product = await db.product.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: {
      media: { orderBy: { position: "asc" } },
      variants: {
        where: { active: true },
        orderBy: { position: "asc" },
        include: {
          offers: true,
          // Les derniers changements de prix suffisent à établir le prix de référence sur 30 jours.
          priceHistory: { orderBy: { validFrom: "desc" }, take: 50 },
        },
      },
    },
  });
  if (!product) return null;

  // Un contenu mal formé en base ne doit pas casser la page : on le signale et on l'ignore.
  const content = productContentSchema.safeParse(product.contentBlocks);
  const sizeGuide = sizeGuideSchema.safeParse(product.sizeGuide);
  if (!content.success) console.error("contentBlocks invalide pour le produit", product.id);
  if (!sizeGuide.success) console.error("sizeGuide invalide pour le produit", product.id);

  const variants: CatalogVariant[] = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    label: v.label,
    widthCm: v.widthCm,
    lengthCm: v.lengthCm,
    recommendedFor: v.recommendedFor,
    priceCents: v.priceCents,
    referencePriceCents: v.showReferencePrice ? referencePriceCents(v.priceHistory) : null,
    availability: variantAvailability(v.offers),
  }));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    packageContents: product.packageContents,
    textileComposition: product.textileComposition,
    careInstructions: product.careInstructions,
    sortingInstructions: product.sortingInstructions,
    gpsr: {
      manufacturerName: product.manufacturerName,
      manufacturerAddress: product.manufacturerAddress,
      manufacturerContact: product.manufacturerContact,
      euResponsibleName: product.euResponsibleName,
      euResponsibleAddress: product.euResponsibleAddress,
      euResponsibleContact: product.euResponsibleContact,
      productReference: product.productReference,
      safetyWarnings: product.safetyWarnings,
    },
    media: product.media,
    content: content.success ? content.data : null,
    sizeGuide: sizeGuide.success ? sizeGuide.data : null,
    variants,
  };
});

export type MainProduct = NonNullable<Awaited<ReturnType<typeof getMainProduct>>>;

/** Offres par lot actives à cet instant. */
export async function getActiveBundles(now = new Date()) {
  const bundles = await db.bundleOffer.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
  });
  return bundles;
}

export async function getActiveShippingRate() {
  return db.shippingRate.findFirst({
    where: { active: true, country: "FR" },
    orderBy: { priceCents: "asc" },
  });
}

export async function getApprovedReviews(productId: string) {
  return db.review.findMany({
    where: { status: "APPROVED", orderItem: { variant: { productId } } },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { id: true, displayName: true, rating: true, body: true, publishedAt: true },
  });
}
