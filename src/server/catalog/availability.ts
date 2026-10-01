/**
 * Disponibilité d'une taille et délai de livraison affiché — fonctions pures.
 *
 * Règles (cahier des charges §4.1 et §5) :
 * - une taille est achetable si au moins une offre fournisseur active n'est pas en rupture ;
 * - le délai affiché est celui de l'offre qui serait réellement utilisée (première offre
 *   disponible par ordre de priorité), jamais une valeur codée en dur ni plus optimiste.
 */

export type OfferForAvailability = {
  priority: number;
  active: boolean;
  /** null = stock inconnu (ex. fournisseur manuel) : considéré disponible. */
  lastKnownStock: number | null;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
};

export type Availability =
  { available: false } | { available: true; deliveryDaysMin: number; deliveryDaysMax: number };

export function variantAvailability(offers: OfferForAvailability[]): Availability {
  const usable = offers
    .filter((o) => o.active && (o.lastKnownStock === null || o.lastKnownStock > 0))
    .sort((a, b) => a.priority - b.priority);
  const first = usable[0];
  if (!first) return { available: false };
  return { available: true, deliveryDaysMin: first.deliveryDaysMin, deliveryDaysMax: first.deliveryDaysMax };
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

/** « Livraison estimée entre le lundi 13 octobre et le vendredi 17 octobre ». */
export function deliveryWindow(
  availability: Extract<Availability, { available: true }>,
  from: Date = new Date(),
): { earliest: Date; latest: Date; label: string } {
  const earliest = addDays(from, availability.deliveryDaysMin);
  const latest = addDays(from, availability.deliveryDaysMax);
  return {
    earliest,
    latest,
    label: `entre le ${dayFormatter.format(earliest)} et le ${dayFormatter.format(latest)}`,
  };
}
