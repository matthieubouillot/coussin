import "server-only";
import type { ActorType, OrderStatus, Prisma } from "@/generated/prisma/client";

/**
 * Machine à états des commandes (cahier des charges §5.4, diagramme en phase 0).
 * Toute transition passe par `transitionOrder` : pas de saut illégal, et chaque changement
 * est journalisé (qui, quand, pourquoi) dans la même transaction que la mise à jour.
 */

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["SENT_TO_SUPPLIER", "FULFILLMENT_ERROR", "CANCELLED", "REFUND_REQUESTED"],
  FULFILLMENT_ERROR: ["SENT_TO_SUPPLIER", "CANCELLED", "REFUND_REQUESTED"],
  SENT_TO_SUPPLIER: ["SHIPPED", "CANCELLED", "REFUND_REQUESTED", "FULFILLMENT_ERROR"],
  SHIPPED: ["DELIVERED", "REFUND_REQUESTED"],
  DELIVERED: ["REFUND_REQUESTED"],
  REFUND_REQUESTED: ["RETURNED", "REFUNDED", "PARTIALLY_REFUNDED"],
  RETURNED: ["REFUNDED", "PARTIALLY_REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "REFUND_REQUESTED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Transition de commande interdite : ${from} → ${to}`);
  }
}

export class ConcurrentTransitionError extends Error {
  constructor(readonly orderId: string) {
    super(`La commande ${orderId} a changé de statut pendant la transition`);
  }
}

/**
 * Change le statut d'une commande dans une transaction existante.
 * Verrou optimiste : la mise à jour ne s'applique que si le statut n'a pas bougé entre-temps.
 */
export async function transitionOrder(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    to: OrderStatus;
    actorType: ActorType;
    actorId?: string;
    reason: string;
    data?: Prisma.OrderUncheckedUpdateManyInput;
  },
): Promise<void> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: params.orderId }, select: { status: true } });
  if (!canTransition(order.status, params.to)) throw new IllegalTransitionError(order.status, params.to);

  const { count } = await tx.order.updateMany({
    where: { id: params.orderId, status: order.status },
    data: { ...params.data, status: params.to },
  });
  if (count !== 1) throw new ConcurrentTransitionError(params.orderId);

  await tx.orderStatusEvent.create({
    data: {
      orderId: params.orderId,
      fromStatus: order.status,
      toStatus: params.to,
      actorType: params.actorType,
      actorId: params.actorId,
      reason: params.reason,
    },
  });
}
