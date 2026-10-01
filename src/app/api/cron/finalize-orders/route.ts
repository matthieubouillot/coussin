import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { finalizePaidOrder } from "@/server/orders/finalize-paid-order";
import { isAuthorizedCron } from "@/server/security/cron-auth";

/**
 * Rattrapage : relance la finalisation (PDF, email de confirmation) des commandes payées
 * pour lesquelles elle a échoué. Le webhook la tente déjà ; ce cron couvre les pannes durables.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });

  const since = new Date(Date.now() - 7 * 86_400_000);
  const settled = new Date(Date.now() - 5 * 60_000);
  const orders = await db.order.findMany({
    where: {
      status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] },
      paidAt: { gte: since, lte: settled },
      emails: { none: { type: "ORDER_CONFIRMATION" } },
    },
    select: { id: true, number: true },
    take: 20,
  });

  let failed = 0;
  for (const order of orders) {
    try {
      await finalizePaidOrder(order.id);
    } catch (error) {
      failed += 1;
      await notifyAdmin(
        `finalize-failed:${order.id}:${new Date().toISOString().slice(0, 13)}`,
        `Finalisation en échec : ${order.number}`,
        [error instanceof Error ? error.message : String(error)],
      );
    }
  }
  return Response.json({ checked: orders.length, failed });
}
