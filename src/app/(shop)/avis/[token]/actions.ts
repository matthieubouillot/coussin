"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { findInvite } from "@/server/reviews/invites";
import { checkRateLimit } from "@/server/security/ratelimit";

export type ReviewState = { ok: boolean; message: string } | null;

export async function submitReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  if (!(await checkRateLimit("contact")))
    return { ok: false, message: "Trop de tentatives, réessayez plus tard." };
  const parsed = z
    .object({
      token: z.string().min(40).max(60),
      orderItemId: z.string().min(1).max(64),
      rating: z.coerce.number().int().min(1).max(5),
      displayName: z.string().trim().min(2, "Indiquez un nom d'affichage").max(40),
      body: z.string().trim().min(10, "Votre avis est trop court (10 caractères minimum)").max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  const invite = await findInvite(parsed.data.token);
  // L'avis ne peut porter que sur un article de CETTE commande : achat vérifié par construction.
  const item = invite?.order.items.find((i) => i.id === parsed.data.orderItemId && !i.review);
  if (!invite || !item) return { ok: false, message: "Ce lien n'est plus valable." };

  await db.$transaction([
    db.review.create({
      data: {
        orderItemId: item.id,
        rating: parsed.data.rating,
        displayName: parsed.data.displayName,
        body: parsed.data.body,
      },
    }),
    ...(invite.order.items.filter((i) => !i.review).length <= 1
      ? [db.reviewInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } })]
      : []),
  ]);
  await notifyAdmin(`review:${item.id}`, "Nouvel avis à modérer", [
    `${parsed.data.rating}/5 — ${parsed.data.displayName}`,
  ]);
  return { ok: true, message: "Merci ! Votre avis sera publié après relecture (sous 7 jours environ)." };
}
