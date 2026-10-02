import { alertOnThresholds } from "@/server/admin/thresholds";
import { syncStockAndPrices } from "@/server/fulfillment/stock-sync";
import { sendReviewInvites } from "@/server/reviews/invites";
import { isAuthorizedCron } from "@/server/security/cron-auth";

// Tâches quotidiennes : stock et prix fournisseurs, demandes d'avis (J+7), seuils. (Phase 7 : purge RGPD.)
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });
  const stock = await syncStockAndPrices();
  const reviewInvites = await sendReviewInvites();
  await alertOnThresholds();
  return Response.json({ stock, reviewInvites });
}
