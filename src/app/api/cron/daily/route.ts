import { alertOnThresholds } from "@/server/admin/thresholds";
import { syncStockAndPrices } from "@/server/fulfillment/stock-sync";
import { applyRetention } from "@/server/gdpr/retention";
import { sendReviewInvites } from "@/server/reviews/invites";
import { isAuthorizedCron } from "@/server/security/cron-auth";

// Tâches quotidiennes : stock et prix fournisseurs, demandes d'avis (J+7), seuils, durées de conservation RGPD.
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });
  const stock = await syncStockAndPrices();
  const reviewInvites = await sendReviewInvites();
  await alertOnThresholds();
  const retention = await applyRetention();
  return Response.json({ stock, reviewInvites, retention });
}
