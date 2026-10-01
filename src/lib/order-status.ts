import type { OrderStatus } from "@/generated/prisma/enums";

/** Libellés présentés au client (jamais de jargon interne). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payée — en préparation",
  SENT_TO_SUPPLIER: "En préparation chez notre fournisseur",
  FULFILLMENT_ERROR: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUND_REQUESTED: "Remboursement en cours",
  REFUNDED: "Remboursée",
  PARTIALLY_REFUNDED: "Partiellement remboursée",
  RETURNED: "Retour reçu",
};
