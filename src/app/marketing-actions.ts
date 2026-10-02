"use server";

import { cookies } from "next/headers";
import { ATTRIBUTION_COOKIE, type Attribution, type MarketingEvent } from "@/lib/marketing/events";
import { attributionSchema, marketingEventSchema } from "@/lib/marketing/schemas";
import { adsConsentFromRequest, marketingContextFromRequest } from "@/server/marketing/context";
import { sendServerEvent } from "@/server/marketing/destinations";
import { checkRateLimit } from "@/server/security/ratelimit";

/**
 * Double de l'événement du pixel, envoyé côté serveur (même eventId → dédupliqué par la régie).
 * Uniquement avec consentement ; les achats et débuts de paiement sont envoyés par le serveur lui-même.
 */
export async function trackEventAction(input: MarketingEvent): Promise<void> {
  const event = marketingEventSchema.safeParse(input);
  if (!event.success || event.data.name === "Purchase" || event.data.name === "InitiateCheckout") return;
  if (!(await checkRateLimit("marketing"))) return;
  const context = await marketingContextFromRequest();
  if (!context) return;
  await sendServerEvent(event.data, context);
}

/** Mémorise la provenance (UTM, identifiant de clic) 30 jours, seulement si le visiteur a consenti. */
export async function saveAttributionAction(input: Attribution): Promise<void> {
  const parsed = attributionSchema.safeParse(input);
  if (!parsed.success || Object.keys(parsed.data).length === 0) return;
  if (!(await adsConsentFromRequest())) return;
  (await cookies()).set(ATTRIBUTION_COOKIE, JSON.stringify(parsed.data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}
