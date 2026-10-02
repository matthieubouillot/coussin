import "server-only";
import type { OrderStatus, SupplierOrderStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { transitionOrder } from "@/server/orders/state-machine";

const PLACED: SupplierOrderStatus[] = ["AWAITING_SUPPLIER_PAYMENT", "PLACED", "SHIPPED", "DELIVERED"];
const SHIPPED: SupplierOrderStatus[] = ["SHIPPED", "DELIVERED"];

/**
 * Fait avancer le statut de la commande client d'après ses commandes fournisseur
 * (un colis par commande fournisseur) : tout placé → SENT_TO_SUPPLIER, tout expédié → SHIPPED,
 * tout livré → DELIVERED. Ne recule jamais et ne touche pas aux commandes annulées / remboursées.
 */
export async function reconcileOrderStatus(
  orderId: string,
  actor: { type: "SYSTEM" | "CRON" | "ADMIN"; id?: string },
): Promise<OrderStatus> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { supplierOrder: { select: { status: true } } } } },
  });
  const statuses = order.items.map((i) => i.supplierOrder?.status ?? null);
  const all = (set: SupplierOrderStatus[]) =>
    statuses.length > 0 && statuses.every((s) => s !== null && set.includes(s));

  const steps: OrderStatus[] = [];
  let current = order.status;
  const advance = (to: OrderStatus, from: OrderStatus[]) => {
    if (from.includes(current)) {
      steps.push(to);
      current = to;
    }
  };
  if (all(PLACED)) advance("SENT_TO_SUPPLIER", ["PAID", "FULFILLMENT_ERROR"]);
  if (all(SHIPPED)) advance("SHIPPED", ["SENT_TO_SUPPLIER"]);
  if (all(["DELIVERED"])) advance("DELIVERED", ["SHIPPED"]);

  if (steps.length > 0) {
    await db.$transaction(async (tx) => {
      for (const to of steps) {
        await transitionOrder(tx, {
          orderId,
          to,
          actorType: actor.type,
          actorId: actor.id,
          reason:
            to === "SENT_TO_SUPPLIER"
              ? "Commandé chez le fournisseur"
              : to === "SHIPPED"
                ? "Tous les colis sont expédiés"
                : "Tous les colis sont livrés",
          data: to === "DELIVERED" ? { deliveredAt: new Date() } : undefined,
        });
      }
    });
  }
  return current;
}

/** Plus aucune offre utilisable pour un article : la commande passe en erreur et l'admin est alerté. */
export async function markFulfillmentError(orderId: string, reason: string): Promise<void> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, number: true },
  });
  if (order.status === "PAID" || order.status === "SENT_TO_SUPPLIER") {
    await db.$transaction((tx) =>
      transitionOrder(tx, { orderId, to: "FULFILLMENT_ERROR", actorType: "SYSTEM", reason }),
    );
  }
  await notifyAdmin(
    `fulfillment-error:${orderId}:${reason}`,
    `Commande ${order.number} en erreur de traitement`,
    [
      reason,
      "Action possible dans l'admin : ajouter une offre fournisseur puis relancer, ou passer la commande en manuel.",
    ],
  );
}
