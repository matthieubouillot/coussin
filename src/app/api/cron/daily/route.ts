import { alertOnThresholds } from "@/server/admin/thresholds";
import { isAuthorizedCron } from "@/server/security/cron-auth";

// Contrôles quotidiens. Phase 5 : synchronisation stock/prix ; phase 7 : purge RGPD.
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });
  await alertOnThresholds();
  return Response.json({ ok: true });
}
