/**
 * Événements marketing (cahier des charges §9), communs au navigateur et au serveur.
 * Le même `eventId` est envoyé par le pixel et par l'API serveur : les régies dédupliquent.
 */

export const MARKETING_EVENTS = ["ViewContent", "AddToCart", "InitiateCheckout", "Purchase"] as const;
export type MarketingEventName = (typeof MARKETING_EVENTS)[number];

export type MarketingEvent = {
  name: MarketingEventName;
  eventId: string;
  /** Montant TTC en centimes. */
  valueCents: number;
  contents: { id: string; name: string; quantity: number; priceCents: number }[];
  pageUrl?: string;
};

/** Noms d'événements par régie (TikTok : « CompletePayment » historique, « Purchase » depuis 2024). */
export const TIKTOK_EVENT_NAMES: Record<MarketingEventName, string> = {
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "Purchase",
};

export const META_EVENT_NAMES: Record<MarketingEventName, string> = {
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "Purchase",
};

/** Cookie (HttpOnly, 30 jours, avec consentement uniquement) mémorisant la provenance de la visite. */
export const ATTRIBUTION_COOKIE = "attribution";

/** Paramètres d'URL retenus pour savoir quelle publicité a amené la vente. */
export const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ttclid",
  "fbclid",
] as const;
export type Attribution = Partial<Record<(typeof ATTRIBUTION_PARAMS)[number], string>>;

export function newEventId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
