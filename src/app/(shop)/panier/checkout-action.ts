"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createCheckout } from "@/server/checkout/create-checkout";
import { env } from "@/server/env";
import { checkRateLimit } from "@/server/security/ratelimit";
import { isStripeConfigured } from "@/server/stripe/stripe";

export type CheckoutActionState = { message: string } | null;

export async function checkoutAction(
  _prev: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  if (!(await checkRateLimit("checkout")))
    return { message: "Trop de tentatives, réessayez dans quelques minutes." };

  // Obligation légale : l'acceptation des CGV est vérifiée côté serveur, pas seulement par le navigateur.
  if (!z.literal("on").safeParse(formData.get("acceptCgv")).success) {
    return { message: "Veuillez accepter les conditions générales de vente." };
  }
  if (!isStripeConfigured()) return { message: "Le paiement en ligne n'est pas encore activé." };

  let url: string;
  try {
    const result = await createCheckout({ siteUrl: env().NEXT_PUBLIC_SITE_URL });
    if (!result.ok) return { message: result.message };
    url = result.url;
  } catch (error) {
    console.error(
      "Création de la session de paiement impossible",
      error instanceof Error ? error.message : error,
    );
    return { message: "Le paiement est momentanément indisponible. Réessayez dans un instant." };
  }
  // redirect() lève une exception de contrôle : il doit rester hors du try/catch.
  redirect(url);
}
