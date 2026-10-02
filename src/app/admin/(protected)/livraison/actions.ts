"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import {
  checkbox,
  eurosToCents,
  optionalDate,
  optionalEurosToCents,
  percentToBps,
} from "@/server/admin/form-helpers";

export type ActionState = { ok: boolean; message: string } | null;

export async function saveShippingRateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      rateId: z.string().max(64).optional(),
      name: z.string().trim().min(3).max(100),
      price: eurosToCents,
      freeAbove: optionalEurosToCents,
    })
    .safeParse({ ...Object.fromEntries(formData), rateId: formData.get("rateId") || undefined });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const data = {
    name: parsed.data.name,
    priceCents: parsed.data.price,
    freeAboveCents: parsed.data.freeAbove,
    active: checkbox(formData, "active"),
  };
  const rate = parsed.data.rateId
    ? await db.shippingRate.update({ where: { id: parsed.data.rateId }, data })
    : await db.shippingRate.create({ data });
  await audit("shipping.update", {
    actorId: admin.id,
    targetType: "shippingRate",
    targetId: rate.id,
    metadata: data,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Tarif de livraison enregistré." };
}

export async function saveBundleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      bundleId: z.string().max(64).optional(),
      name: z.string().trim().min(3).max(100),
      kind: z.enum(["QUANTITY", "COMBO"]),
      minQuantity: z
        .string()
        .trim()
        .transform((v) => (v === "" ? null : Number(v)))
        .pipe(z.int().min(2).max(20).nullable()),
      comboVariantIds: z.array(z.string().min(1).max(64)).max(10),
      discountType: z.enum(["PERCENT", "FIXED"]),
      value: z.string(),
      startsAt: optionalDate,
      endsAt: optionalDate,
    })
    .refine((b) => (b.kind === "QUANTITY" ? b.minQuantity !== null : b.comboVariantIds.length >= 2), {
      message: "Lot par quantité : indiquez un minimum. Combo : cochez au moins deux tailles.",
    })
    .safeParse({
      ...Object.fromEntries(formData),
      bundleId: formData.get("bundleId") || undefined,
      comboVariantIds: formData.getAll("comboVariantIds"),
    });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const value = (parsed.data.discountType === "PERCENT" ? percentToBps : eurosToCents).safeParse(
    parsed.data.value,
  );
  if (!value.success) return { ok: false, message: value.error.issues[0]?.message ?? "Valeur invalide." };

  const { bundleId, value: _raw, ...rest } = parsed.data;
  const data = { ...rest, discountValue: value.data, active: checkbox(formData, "active") };
  const bundle = bundleId
    ? await db.bundleOffer.update({ where: { id: bundleId }, data })
    : await db.bundleOffer.create({ data });
  await audit("bundle.update", { actorId: admin.id, targetType: "bundle", targetId: bundle.id });
  revalidatePath("/", "layout");
  return { ok: true, message: "Offre par lot enregistrée." };
}
