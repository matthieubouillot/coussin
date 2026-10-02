import { syncTracking } from "@/server/fulfillment/tracking";
import { isAuthorizedCron } from "@/server/security/cron-auth";

// Toutes les heures : statut, paiement, suivi et livraison des commandes fournisseur en cours.
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });
  return Response.json(await syncTracking());
}
