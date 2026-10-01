/**
 * Prix de référence d'une annonce de réduction (art. L112-1-1 du Code de la consommation,
 * directive « Omnibus ») : le prix le plus bas pratiqué pendant les 30 jours précédant
 * l'application de la réduction.
 *
 * Retourne `null` quand aucun prix barré ne peut être affiché légalement : pas de baisse
 * réelle, historique insuffisant pour la prouver, ou réduction trop ancienne (au-delà de
 * 30 jours, le prix réduit est devenu le prix habituel : continuer à le barrer serait trompeur).
 */

export type PricePoint = { priceCents: number; validFrom: Date };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function referencePriceCents(history: PricePoint[], now: Date = new Date()): number | null {
  const points = history
    .filter((p) => p.validFrom.getTime() <= now.getTime())
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const current = points.at(-1);
  if (!current) return null;
  if (now.getTime() - current.validFrom.getTime() > THIRTY_DAYS_MS) return null;

  // Fenêtre : les 30 jours qui précèdent l'entrée en vigueur du prix actuel.
  const windowEnd = current.validFrom.getTime();
  const windowStart = windowEnd - THIRTY_DAYS_MS;
  const previous = points.slice(0, -1);

  // Prix en vigueur au début de la fenêtre : le dernier point antérieur à windowStart.
  // Sans lui, on ne peut pas prouver le prix pratiqué sur toute la fenêtre.
  const inForceAtStart = previous.filter((p) => p.validFrom.getTime() <= windowStart).at(-1);
  if (!inForceAtStart) return null;

  const duringWindow = previous.filter((p) => p.validFrom.getTime() > windowStart);
  const lowest = Math.min(inForceAtStart.priceCents, ...duringWindow.map((p) => p.priceCents));

  return lowest > current.priceCents ? lowest : null;
}
