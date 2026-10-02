import { z } from "zod";
import { CONSENT_MAX_AGE_SECONDS, CONSENT_POLICY_VERSION, type ConsentCookie } from "@/lib/consent";

// Validation du cookie de consentement (serveur et proxy uniquement : Zod n'est pas envoyé au navigateur).

export const consentChoicesSchema = z.object({ ads: z.boolean() });

export const consentCookieSchema = z.object({
  v: z.literal(CONSENT_POLICY_VERSION),
  id: z.string().min(8).max(64),
  choices: consentChoicesSchema,
  at: z.number().int(),
});

/** Valeur du cookie → consentement valide, ou null (absent, expiré, ancienne version, altéré). */
export function parseConsentCookie(raw: string | undefined, now = Date.now()): ConsentCookie | null {
  if (!raw) return null;
  try {
    const parsed = consentCookieSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    if (now - parsed.data.at > CONSENT_MAX_AGE_SECONDS * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
