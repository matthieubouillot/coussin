import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ReviewRequestEmail } from "@/emails/TransactionalEmails";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { sendEmailOnce } from "@/server/email/mailer";
import { emailShop } from "@/server/email/shop-identity";

const INVITE_DELAY_DAYS = 7;
const INVITE_VALIDITY_DAYS = 60;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cron quotidien : 7 jours après la livraison, un lien personnel et à usage unique est envoyé au
 * client pour déposer un avis. Seul le hash du jeton est stocké.
 */
export async function sendReviewInvites(now = new Date()): Promise<number> {
  const orders = await db.order.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { lte: new Date(now.getTime() - INVITE_DELAY_DAYS * 86_400_000) },
      reviewInvite: null,
      customer: { anonymizedAt: null },
    },
    take: 50,
  });
  for (const order of orders) {
    const token = randomBytes(32).toString("base64url");
    await db.reviewInvite.create({
      data: {
        orderId: order.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + INVITE_VALIDITY_DAYS * 86_400_000),
      },
    });
    await sendEmailOnce({
      type: "REVIEW_REQUEST",
      dedupKey: `REVIEW_REQUEST:${order.id}`,
      orderId: order.id,
      to: order.email,
      subject: "Votre avis sur votre coussin",
      react: ReviewRequestEmail({
        shop: await emailShop(),
        orderNumber: order.number,
        customerName: order.shippingName ?? "",
        reviewUrl: `${env().NEXT_PUBLIC_SITE_URL}/avis/${token}`,
      }),
    });
  }
  return orders.length;
}

/** Invitation valide pour ce jeton (non utilisée, non expirée), avec les articles à évaluer. */
export async function findInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const invite = await db.reviewInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      order: {
        select: {
          shippingName: true,
          items: {
            select: { id: true, productName: true, variantLabel: true, review: { select: { id: true } } },
          },
        },
      },
    },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

/** « Camille Martin » → « Camille M. » : nom affiché par défaut, sans le nom complet. */
export function defaultDisplayName(fullName: string | null): string {
  const [first, ...rest] = (fullName ?? "").trim().split(/\s+/);
  if (!first) return "Client";
  const initial = rest.at(-1)?.[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}
