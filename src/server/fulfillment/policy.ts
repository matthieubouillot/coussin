/**
 * Règles de fulfillment validées en phase 0 (Q12), en fonctions pures testées.
 */

/** Délais entre tentatives après une erreur temporaire : 1 min, 5 min, 15 min, 1 h, 4 h. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 4 * 60 * 60_000] as const;
/** Nombre total de tentatives sur une même offre avant bascule (1 essai + 5 réessais). */
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
/** Une tentative bloquée plus longtemps est considérée comme incertaine. */
export const STALE_PLACING_MS = 10 * 60_000;

export function nextRetryAt(attemptsDone: number, now = Date.now()): Date | null {
  const delay = RETRY_DELAYS_MS[attemptsDone - 1];
  return delay === undefined ? null : new Date(now + delay);
}

export type CandidateOffer = { id: string; priority: number; active: boolean; lastKnownStock: number | null };

/**
 * Prochaine offre à essayer pour un article : offres actives, non épuisées connues, par priorité,
 * en excluant celles qui ont déjà échoué pour cette commande.
 */
export function nextCandidate<T extends CandidateOffer>(offers: T[], failedOfferIds: Set<string>): T | null {
  return (
    offers
      .filter(
        (o) => o.active && !failedOfferIds.has(o.id) && (o.lastKnownStock === null || o.lastKnownStock > 0),
      )
      .sort((a, b) => a.priority - b.priority)[0] ?? null
  );
}

/** Marge unitaire en points de base sur le prix de vente TTC (franchise de TVA : TTC = HT). */
export function marginBps(salePriceCents: number, unitCostCents: number, shippingCostCents: number): number {
  if (salePriceCents <= 0) return 0;
  return Math.round(((salePriceCents - unitCostCents - shippingCostCents) / salePriceCents) * 10_000);
}

/** Conversion USD → EUR avec le taux saisi dans l'admin (euros pour 1 USD, en millionièmes). */
export function usdCentsToEurCents(usdCents: number, usdToEurMicros: number): number {
  return Math.round((usdCents * usdToEurMicros) / 1_000_000);
}
