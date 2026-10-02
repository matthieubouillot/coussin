import "server-only";
import { SupplierError } from "@/server/fulfillment/types";

const TIMEOUT_MS = 20_000;

/**
 * Appel HTTP vers un fournisseur, avec classement prudent des échecs.
 *
 * `mutating` = l'appel crée quelque chose (commande). Dans ce cas, tout échec qui laisse un doute
 * sur la prise en compte (délai dépassé, coupure en cours d'échange, erreur 5xx) est AMBIGUOUS :
 * il ne sera jamais rejoué automatiquement, pour ne pas commander deux fois.
 */
export async function supplierFetch(
  url: string,
  init: RequestInit,
  options: { mutating: boolean },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    // Connexion jamais établie : la requête n'est pas partie, on peut réessayer.
    if (code && ["ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN"].includes(code)) {
      throw new SupplierError("TRANSIENT", `Fournisseur injoignable (${code})`);
    }
    throw new SupplierError(
      options.mutating ? "AMBIGUOUS" : "TRANSIENT",
      `Échange interrompu : ${(error as Error).name}`,
    );
  }

  if (response.status === 429) throw new SupplierError("TRANSIENT", "Quota d'appels fournisseur dépassé");
  if (response.status >= 500) {
    throw new SupplierError(
      options.mutating ? "AMBIGUOUS" : "TRANSIENT",
      `Erreur fournisseur HTTP ${response.status}`,
    );
  }
  if (!response.ok) throw new SupplierError("PERMANENT", `Requête refusée HTTP ${response.status}`);

  try {
    return await response.json();
  } catch {
    throw new SupplierError(options.mutating ? "AMBIGUOUS" : "TRANSIENT", "Réponse fournisseur illisible");
  }
}

export { decimalToCents, universalTrackingUrl } from "@/server/fulfillment/money";
