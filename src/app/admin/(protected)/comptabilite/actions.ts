"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eurosToCents } from "@/server/admin/form-helpers";
import { audit } from "@/server/audit/audit";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { parisLocalToDate } from "@/lib/paris-time";

export type ActionState = { ok: boolean; message: string } | null;

/** Achat saisi à la main (échantillon, commande passée hors API…). Les achats API arrivent en phase 5. */
export async function addPurchaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      supplierName: z.string().trim().min(1).max(100),
      reference: z.string().trim().min(1).max(100),
      description: z.string().trim().min(1).max(300),
      amount: eurosToCents,
      paymentMethod: z.string().trim().min(1).max(100),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const { date, amount, ...rest } = parsed.data;
  const record = await db.purchaseRecord.create({
    data: { ...rest, amountCents: amount, date: parisLocalToDate(`${date}T12:00`)! },
  });
  await audit("purchase.create", { actorId: admin.id, targetType: "purchase", targetId: record.id });
  revalidatePath("/admin/comptabilite");
  return { ok: true, message: "Achat ajouté au registre." };
}
