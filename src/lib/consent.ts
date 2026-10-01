import { z } from "zod";

/**
 * Consentement cookies (recommandations CNIL) — types et règles partagés client/serveur.
 *
 * - Aucun traceur non essentiel avant un choix explicite ; l'absence de choix vaut refus.
 * - Le choix est conservé 6 mois au maximum (exigence du cahier des charges), puis redemandé.
 * - Changer la version de la politique invalide les choix existants.
 */

export const CONSENT_COOKIE_NAME = "consentement";
export const CONSENT_POLICY_VERSION = "2026-10-01";
export const CONSENT_MAX_AGE_SECONDS = 182 * 24 * 60 * 60;

/** Finalités soumises à consentement. Ajouter une entrée ici quand un nouveau traceur arrive. */
export const CONSENT_PURPOSES = [
  {
    key: "ads",
    title: "Publicité et mesure des campagnes",
    description:
      "Permet à TikTok (et, s'il est activé, Meta) de mesurer l'efficacité de nos publicités et de vous proposer des annonces pertinentes. Ces partenaires peuvent déposer des cookies et recevoir des informations sur votre navigation et vos achats sur ce site.",
  },
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]["key"];

export const consentChoicesSchema = z.object({ ads: z.boolean() });
export type ConsentChoices = z.infer<typeof consentChoicesSchema>;

export const consentCookieSchema = z.object({
  v: z.literal(CONSENT_POLICY_VERSION),
  id: z.string().min(8).max(64),
  choices: consentChoicesSchema,
  at: z.number().int(),
});
export type ConsentCookie = z.infer<typeof consentCookieSchema>;

export const REFUSE_ALL: ConsentChoices = { ads: false };
export const ACCEPT_ALL: ConsentChoices = { ads: true };

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

export function hasConsent(consent: ConsentCookie | null, purpose: ConsentPurpose): boolean {
  return consent?.choices[purpose] === true;
}
