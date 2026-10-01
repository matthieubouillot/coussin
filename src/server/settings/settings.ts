import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import {
  legalIdentitySchema,
  PLACEHOLDER_LEGAL_IDENTITY,
  todo,
  type LegalIdentity,
} from "@/server/settings/legal-identity";

export type ShopConfig = {
  shopName: string;
  legal: LegalIdentity;
  taxMode: "FRANCHISE_293B" | "STANDARD";
  taxRateBps: number;
  christmasBanner: string | null;
  cgvVersion: string;
};

/**
 * Réglages de la boutique, lus une fois par requête.
 * Sans ligne en base (projet neuf), on sert les placeholders : le site reste consultable
 * et chaque information manquante est visible comme telle.
 */
export const getShopConfig = cache(async (): Promise<ShopConfig> => {
  const row = await db.shopSettings.findUnique({ where: { id: "singleton" } });
  const parsedLegal = legalIdentitySchema.safeParse(row?.legalIdentity);

  return {
    shopName: row?.shopName ?? todo("nom de la boutique"),
    legal: parsedLegal.success ? parsedLegal.data : PLACEHOLDER_LEGAL_IDENTITY,
    taxMode: row?.taxMode ?? "FRANCHISE_293B",
    taxRateBps: row?.defaultTaxRateBps ?? 0,
    christmasBanner: row?.christmasBannerEnabled ? (row.christmasBannerText ?? null) : null,
    cgvVersion: row?.cgvVersion ?? "2026-10-01",
  };
});
