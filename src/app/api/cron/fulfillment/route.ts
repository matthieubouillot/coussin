import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { fulfillOrder } from "@/server/fulfillment/dispatch";
import { STALE_PLACING_MS } from "@/server/fulfillment/policy";
import { isAuthorizedCron } from "@/server/security/cron-auth";
import { safeErrorMessage } from "@/lib/logging/safe-error";

/**
 * Rattrapage (toutes les 10 min) : commandes payées jamais transmises, réessais arrivés à échéance,
 * envois bloqués « en cours » (résultat incertain → vérification manuelle, jamais de renvoi auto).
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });
  const now = new Date();

  const stale = await db.supplierOrder.findMany({
    where: { status: "PLACING", claimedAt: { lt: new Date(now.getTime() - STALE_PLACING_MS) } },
    include: { order: { select: { number: true } } },
  });
  for (const so of stale) {
    await db.supplierOrder.update({
      where: { id: so.id },
      data: { status: "NEEDS_CHECK", lastError: "Tentative interrompue" },
    });
    await notifyAdmin(
      `needs-check:${so.id}`,
      `Commande ${so.order.number} : envoi au fournisseur interrompu`,
      ["Vérifier dans le compte fournisseur si la commande existe avant de relancer depuis l'admin."],
    );
  }

  const orders = await db.order.findMany({
    where: {
      OR: [
        {
          status: "PAID",
          paidAt: { lt: new Date(now.getTime() - 5 * 60_000) },
          supplierOrders: { none: {} },
        },
        {
          supplierOrders: {
            some: { status: "QUEUED", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
          },
        },
      ],
    },
    select: { id: true },
    take: 20,
  });
  for (const order of orders) {
    try {
      await fulfillOrder(order.id);
    } catch (error) {
      console.error("Rattrapage fulfillment en échec", order.id, safeErrorMessage(error));
    }
  }
  return Response.json({ stale: stale.length, processed: orders.length });
}
