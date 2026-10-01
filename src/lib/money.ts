// Tous les montants circulent en centimes entiers ; la conversion en texte n'a lieu qu'à l'affichage.

const eurFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatEuros(cents: number): string {
  return eurFormatter.format(cents / 100);
}

/** Pourcentage exprimé en points de base (1000 = 10 %), arrondi au centime le plus proche. */
export function applyBps(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}
