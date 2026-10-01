"use server";

import { z } from "zod";
import { WithdrawalAckEmail } from "@/emails/TransactionalEmails";
import { findOrderByNumberAndEmail, orderLookupSchema } from "@/server/after-sales/find-order";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { sendEmailOnce } from "@/server/email/mailer";
import { emailShop } from "@/server/email/shop-identity";
import { checkRateLimit } from "@/server/security/ratelimit";
import { verifyTurnstile } from "@/server/security/turnstile";
import { getShopConfig } from "@/server/settings/settings";

export type WithdrawalState = { ok: boolean; message: string } | null;

export async function withdrawalAction(_prev: WithdrawalState, formData: FormData): Promise<WithdrawalState> {
  if (!(await checkRateLimit("withdrawal")))
    return { ok: false, message: "Trop de tentatives, réessayez dans 10 minutes." };
  if (!(await verifyTurnstile(formData.get("turnstileToken")))) {
    return { ok: false, message: "Vérification anti-robot échouée, réessayez." };
  }

  const parsed = orderLookupSchema.extend({ message: z.string().trim().max(2000).optional() }).safeParse({
    orderNumber: formData.get("orderNumber"),
    email: formData.get("email"),
    message: formData.get("message") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  const order = await findOrderByNumberAndEmail(parsed.data.orderNumber, parsed.data.email);
  if (!order)
    return { ok: false, message: "Aucune commande ne correspond à ce numéro et à cette adresse email." };

  const request = await db.withdrawalRequest.create({
    data: { orderId: order.id, message: parsed.data.message },
  });

  // L'accusé de réception sur support durable est une obligation (art. L221-21) : son échec doit se voir.
  const config = await getShopConfig();
  await sendEmailOnce({
    type: "WITHDRAWAL_ACK",
    dedupKey: `WITHDRAWAL_ACK:${request.id}`,
    orderId: order.id,
    to: order.email,
    subject: `Rétractation reçue — commande ${order.number}`,
    react: WithdrawalAckEmail({
      shop: await emailShop(),
      orderNumber: order.number,
      customerName: order.shippingName ?? "",
      returnAddress: config.legal.returnAddress,
    }),
  });
  await notifyAdmin(`withdrawal:${request.id}`, `Rétractation — commande ${order.number}`, [
    parsed.data.message ? `Message du client : ${parsed.data.message}` : "Aucun message.",
    "À traiter dans l'admin : attendre le retour puis rembourser sous 14 jours.",
  ]);

  return {
    ok: true,
    message: "Votre demande est enregistrée. Un accusé de réception vient de vous être envoyé par email.",
  };
}
