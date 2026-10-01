"use server";

import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { findOrderByNumberAndEmail, orderLookupSchema } from "@/server/after-sales/find-order";
import { checkRateLimit } from "@/server/security/ratelimit";
import { verifyTurnstile } from "@/server/security/turnstile";

export type TrackingState =
  | { ok: false; message: string }
  | {
      ok: true;
      orderNumber: string;
      statusLabel: string;
      items: string[];
      parcels: { trackingNumber: string; trackingUrl: string | null; carrier: string | null }[];
    }
  | null;

const NOT_FOUND = {
  ok: false,
  message: "Aucune commande ne correspond à ce numéro et à cette adresse email.",
} as const;

export async function trackOrderAction(_prev: TrackingState, formData: FormData): Promise<TrackingState> {
  if (!(await checkRateLimit("orderTracking")))
    return { ok: false, message: "Trop de tentatives, réessayez dans 10 minutes." };
  if (!(await verifyTurnstile(formData.get("turnstileToken")))) {
    return { ok: false, message: "Vérification anti-robot échouée, réessayez." };
  }

  const parsed = orderLookupSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };

  const order = await findOrderByNumberAndEmail(parsed.data.orderNumber, parsed.data.email);
  if (!order) return NOT_FOUND;

  return {
    ok: true,
    orderNumber: order.number,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    items: order.items.map((i) => `${i.quantity} × ${i.productName} — taille ${i.variantLabel}`),
    parcels: order.supplierOrders.map((p) => ({
      trackingNumber: p.trackingNumber ?? "",
      trackingUrl: p.trackingUrl,
      carrier: p.carrier,
    })),
  };
}
