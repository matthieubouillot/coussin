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

export type ConsentChoices = { ads: boolean };
export type ConsentCookie = {
  v: typeof CONSENT_POLICY_VERSION;
  id: string;
  choices: ConsentChoices;
  at: number;
};

export const REFUSE_ALL: ConsentChoices = { ads: false };
export const ACCEPT_ALL: ConsentChoices = { ads: true };

export function hasConsent(consent: ConsentCookie | null, purpose: ConsentPurpose): boolean {
  return consent?.choices[purpose] === true;
}
