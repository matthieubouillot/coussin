import { createHmac } from "node:crypto";
import type { SupplierOrderState } from "@/server/fulfillment/types";

// Fonctions pures du protocole AliExpress (sans accès réseau ni base), testées unitairement.

/** Signature HMAC-SHA256 : (chemin pour les routes /rest) + clés triées concaténées à leurs valeurs. */
export function signAliExpress(params: Record<string, string>, secret: string, apiPath?: string): string {
  const base =
    (apiPath ?? "") +
    Object.keys(params)
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join("");
  return createHmac("sha256", secret).update(base, "utf8").digest("hex").toUpperCase();
}

/** Statuts AliExpress → état normalisé. Tout statut inconnu est conservé tel quel (UNKNOWN) et journalisé. */
export function mapAliExpressStatus(
  orderStatus: string | undefined,
  logisticsStatus: string | undefined,
): SupplierOrderState {
  if (orderStatus === "PLACE_ORDER_SUCCESS") return "AWAITING_PAYMENT";
  if (orderStatus === "IN_CANCEL") return "CANCELLED";
  if (orderStatus === "FINISH" || logisticsStatus === "BUYER_ACCEPT_GOODS") return "DELIVERED";
  if (
    orderStatus === "WAIT_BUYER_ACCEPT_GOODS" ||
    orderStatus === "SELLER_PART_SEND_GOODS" ||
    logisticsStatus === "SELLER_SEND_GOODS"
  ) {
    return "SHIPPED";
  }
  if (
    ["WAIT_SELLER_SEND_GOODS", "RISK_CONTROL", "WAIT_SELLER_EXAMINE_MONEY", "FUND_PROCESSING"].includes(
      orderStatus ?? "",
    )
  )
    return "PROCESSING";
  return "UNKNOWN";
}
