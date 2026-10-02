"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_PARAMS, type Attribution } from "@/lib/marketing/events";
import { attributionSchema } from "@/lib/marketing/schemas";
import { createCheckout, type CheckoutMarketing } from "@/server/checkout/create-checkout";
import { marketingContextFromRequest } from "@/server/marketing/context";
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
    const result = await createCheckout({
      siteUrl: env().NEXT_PUBLIC_SITE_URL,
      marketing: await checkoutMarketing(formData),
    });
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

/** Provenance : celle de la visite en cours (formulaire), sinon celle mémorisée avec consentement. */
async function checkoutMarketing(formData: FormData): Promise<CheckoutMarketing> {
  const fromForm: Attribution = {};
  for (const key of ATTRIBUTION_PARAMS) {
    const value = formData.get(key);
    if (typeof value === "string" && value) fromForm[key] = value;
  }
  let attribution = attributionSchema.safeParse(fromForm).data ?? {};
  if (Object.keys(attribution).length === 0) {
    try {
      attribution = attributionSchema.parse(
        JSON.parse((await cookies()).get(ATTRIBUTION_COOKIE)?.value ?? "{}"),
      );
    } catch {
      attribution = {};
    }
  }
  const eventId = z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,80}$/)
    .safeParse(formData.get("marketingEventId"));
  return {
    initiateCheckoutEventId: eventId.success ? eventId.data : null,
    attribution,
    context: await marketingContextFromRequest({ ttclid: attribution.ttclid, fbclid: attribution.fbclid }),
  };
}
