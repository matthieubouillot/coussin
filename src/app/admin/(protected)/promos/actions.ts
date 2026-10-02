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

export async function savePromoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const base = z.object({
    promoId: z.string().max(64).optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, "Code : 3 à 40 caractères A-Z, 0-9, - ou _"),
    discountType: z.enum(["PERCENT", "FIXED"]),
    value: z.string(),
    minSubtotal: optionalEurosToCents,
    maxUses: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .pipe(z.int().min(1).nullable()),
    startsAt: optionalDate,
    expiresAt: optionalDate,
  });
  const parsed = base.safeParse({
    ...Object.fromEntries(formData),
    promoId: formData.get("promoId") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const value = (parsed.data.discountType === "PERCENT" ? percentToBps : eurosToCents).safeParse(
    parsed.data.value,
  );
  if (!value.success) return { ok: false, message: value.error.issues[0]?.message ?? "Valeur invalide." };

  const { promoId, value: _raw, minSubtotal, ...rest } = parsed.data;
  const data = {
    ...rest,
    discountValue: value.data,
    minSubtotalCents: minSubtotal,
    active: checkbox(formData, "active"),
  };
  try {
    const promo = promoId
      ? await db.promoCode.update({ where: { id: promoId }, data })
      : await db.promoCode.create({ data });
    await audit(promoId ? "promo.update" : "promo.create", {
      actorId: admin.id,
      targetType: "promo",
      targetId: promo.id,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002")
      return { ok: false, message: "Ce code existe déjà." };
    throw error;
  }
  revalidatePath("/admin/promos");
  return { ok: true, message: "Code promo enregistré." };
}
