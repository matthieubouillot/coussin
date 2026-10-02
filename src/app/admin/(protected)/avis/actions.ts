"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";

export type ActionState = { ok: boolean; message: string } | null;

export async function moderateReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      reviewId: z.string().min(1).max(64),
      decision: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().trim().max(500).optional(),
    })
    .refine((r) => r.decision === "APPROVED" || (r.note && r.note.length >= 3), "Indiquez le motif du refus.")
    .safeParse({ ...Object.fromEntries(formData), note: formData.get("note") || undefined });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  // Le texte de l'avis n'est jamais modifiable : on publie ou on refuse, sans retoucher.
  await db.review.update({
    where: { id: parsed.data.reviewId },
    data: {
      status: parsed.data.decision,
      moderationNote: parsed.data.note ?? null,
      publishedAt: parsed.data.decision === "APPROVED" ? new Date() : null,
    },
  });
  await audit(`review.${parsed.data.decision.toLowerCase()}`, {
    actorId: admin.id,
    targetType: "review",
    targetId: parsed.data.reviewId,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: parsed.data.decision === "APPROVED" ? "Avis publié." : "Avis refusé." };
}
