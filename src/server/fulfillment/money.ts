// Utilitaires purs partagés par les adaptateurs fournisseur.

/** « 12,34 » ou « 12.34 » (unités) → centimes. */
export function decimalToCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Lien de suivi universel (17TRACK), utilisable quel que soit le transporteur. */
export function universalTrackingUrl(trackingNumber: string): string {
  return `https://t.17track.net/fr#nums=${encodeURIComponent(trackingNumber)}`;
}
