"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { checkRateLimit } from "@/server/security/ratelimit";
import { verifyTurnstile } from "@/server/security/turnstile";

export type ContactState = { ok: boolean; message: string } | null;

const contactSchema = z.object({
  name: z.string().trim().min(1, "Indiquez votre nom").max(100),
  email: z.email("Adresse email invalide").trim().toLowerCase(),
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^C-[23456789A-Z]{8}$/, "Numéro de commande invalide")
    .optional(),
  body: z.string().trim().min(10, "Votre message est trop court").max(5000),
});

export async function contactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  if (!(await checkRateLimit("contact")))
    return { ok: false, message: "Trop de messages, réessayez dans 10 minutes." };
  if (!(await verifyTurnstile(formData.get("turnstileToken")))) {
    return { ok: false, message: "Vérification anti-robot échouée, réessayez." };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    orderNumber: formData.get("orderNumber") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  const message = await db.contactMessage.create({ data: parsed.data });
  await notifyAdmin(`contact:${message.id}`, `Message de ${parsed.data.name}`, [
    `Email : ${parsed.data.email}`,
    parsed.data.orderNumber ? `Commande : ${parsed.data.orderNumber}` : "Sans numéro de commande",
    parsed.data.body,
  ]);
  return { ok: true, message: "Merci, votre message a bien été envoyé. Nous vous répondons par email." };
}
