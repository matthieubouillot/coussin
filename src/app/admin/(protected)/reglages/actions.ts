"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkbox, optionalEurosToCents } from "@/server/admin/form-helpers";
import { audit } from "@/server/audit/audit";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { legalIdentitySchema } from "@/server/settings/legal-identity";

export type ActionState = { ok: boolean; message: string } | null;

const percent = z
  .string()
  .trim()
  .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Pourcentage invalide")
  .transform((v) => Math.round(Number(v.replace(",", ".")) * 100))
  .refine((v) => v >= 0 && v <= 10_000, "Entre 0 et 100 %");

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const f = Object.fromEntries(formData);
  const parsed = z
    .object({
      shopName: z.string().trim().min(2).max(80),
      legal: legalIdentitySchema,
      christmasBannerText: z.string().trim().max(200),
      taxMode: z.enum(["FRANCHISE_293B", "STANDARD"]),
      taxRate: percent,
      marginAlert: percent,
      thresholdAlertRatio: percent,
      lowStockThreshold: z.coerce.number().int().min(0).max(10_000),
      microCeiling: optionalEurosToCents,
      vatThreshold: optionalEurosToCents,
      invoicePrefix: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2,6}$/, "Préfixe : 2 à 6 lettres"),
      cgvVersion: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Version des CGV : date AAAA-MM-JJ"),
    })
    .safeParse({
      ...f,
      legal: {
        sellerName: f.sellerName,
        tradeName: f.tradeName,
        legalStatus: f.legalStatus,
        siret: f.siret,
        address: f.address,
        email: f.email,
        phone: f.phone,
        publicationDirector: f.publicationDirector,
        returnAddress: f.returnAddress,
        host: { name: f.hostName, address: f.hostAddress, contact: f.hostContact },
        mediator: { name: f.mediatorName, address: f.mediatorAddress, website: f.mediatorWebsite },
      },
    });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `${issue?.path.join(".")} : ${issue?.message}` };
  }
  const d = parsed.data;
  if (d.taxMode === "STANDARD" && d.taxRate === 0)
    return { ok: false, message: "TVA activée : indiquez un taux." };

  const current = await db.shopSettings.findUnique({ where: { id: "singleton" } });
  // Changer de série après la première facture casserait la continuité de la numérotation.
  if (current && current.invoicePrefix !== d.invoicePrefix && (await db.invoice.count()) > 0) {
    return {
      ok: false,
      message: "Le préfixe de facturation ne peut plus changer : des factures ont déjà été émises.",
    };
  }

  const data = {
    shopName: d.shopName,
    legalIdentity: d.legal,
    christmasBannerEnabled: checkbox(formData, "christmasBannerEnabled"),
    christmasBannerText: d.christmasBannerText || null,
    taxMode: d.taxMode,
    defaultTaxRateBps: d.taxRate,
    marginAlertThresholdBps: d.marginAlert,
    thresholdAlertRatioBps: d.thresholdAlertRatio,
    lowStockThreshold: d.lowStockThreshold,
    microRevenueCeilingCents: d.microCeiling,
    vatFranchiseThresholdCents: d.vatThreshold,
    invoicePrefix: d.invoicePrefix,
    cgvVersion: d.cgvVersion,
  };
  await db.shopSettings.upsert({ where: { id: "singleton" }, create: data, update: data });
  await audit("settings.update", {
    actorId: admin.id,
    metadata: {
      taxMode: d.taxMode,
      taxRateBps: d.taxRate,
      invoicePrefix: d.invoicePrefix,
      cgvVersion: d.cgvVersion,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Réglages enregistrés." };
}
