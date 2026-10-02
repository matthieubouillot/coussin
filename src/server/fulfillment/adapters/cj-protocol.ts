import type { SupplierOrderState } from "@/server/fulfillment/types";

/** Statuts de commande CJ (documentation officielle) → état normalisé. */
export function mapCjStatus(status: string | null | undefined): SupplierOrderState {
  switch (status) {
    case "CREATED":
    case "IN_CART":
    case "UNPAID":
      return "AWAITING_PAYMENT";
    case "PENDING":
    case "PROCESSING":
    case "UNSHIPPED":
      return "PROCESSING";
    case "SHIPPED":
      return "SHIPPED";
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}
