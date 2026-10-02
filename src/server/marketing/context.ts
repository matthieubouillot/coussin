import "server-only";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { CONSENT_COOKIE_NAME, hasConsent } from "@/lib/consent";
import { parseConsentCookie } from "@/lib/consent-schema";

/**
 * Contexte publicitaire d'un visiteur ayant consenti : identifiants des régies (cookies first-party
 * qu'elles déposent), identifiants de clic, IP et navigateur (utilisés par les régies pour
 * rapprocher l'événement d'une publicité). Sans consentement : null, rien n'est lu.
 */
export const marketingContextSchema = z.object({
  ttp: z.string().max(200).nullish(),
  ttclid: z.string().max(500).nullish(),
  fbp: z.string().max(200).nullish(),
  fbc: z.string().max(500).nullish(),
  ip: z.string().max(64).nullish(),
  userAgent: z.string().max(500).nullish(),
});
export type MarketingContext = z.infer<typeof marketingContextSchema>;

export async function adsConsentFromRequest(): Promise<boolean> {
  const store = await cookies();
  return hasConsent(parseConsentCookie(store.get(CONSENT_COOKIE_NAME)?.value), "ads");
}

export async function marketingContextFromRequest(
  clickIds: { ttclid?: string; fbclid?: string } = {},
): Promise<MarketingContext | null> {
  if (!(await adsConsentFromRequest())) return null;
  const store = await cookies();
  const h = await headers();
  const fbc = store.get("_fbc")?.value ?? (clickIds.fbclid ? `fb.1.${Date.now()}.${clickIds.fbclid}` : null);
  return {
    ttp: store.get("_ttp")?.value ?? null,
    ttclid: clickIds.ttclid ?? null,
    fbp: store.get("_fbp")?.value ?? null,
    fbc,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}
