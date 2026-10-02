import "server-only";
import { DeliveredEmail, ShippedEmail } from "@/emails/TransactionalEmails";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { sendEmailOnce } from "@/server/email/mailer";
import { emailShop } from "@/server/email/shop-identity";
import { fulfillOrder } from "@/server/fulfillment/dispatch";
import { universalTrackingUrl } from "@/server/fulfillment/money";
import { reconcileOrderStatus } from "@/server/fulfillment/order-status";
import { recordPurchase } from "@/server/fulfillment/purchases";
import { getAdapter } from "@/server/fulfillment/registry";
import type { Tracking } from "@/server/fulfillment/types";

type Actor = { type: "SYSTEM" | "CRON" | "ADMIN"; id?: string };

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

/** Colis expédié : enregistre le suivi, prévient le client (un email par colis), fait avancer la commande. */
export async function markParcelShipped(
  supplierOrderId: string,
  tracking: Omit<Tracking, "delivered">,
  actor: Actor,
): Promise<void> {
  const so = await db.supplierOrder.update({
    where: { id: supplierOrderId },
    data: {
      status: "SHIPPED",
      trackingNumber: tracking.trackingNumber,
      carrier: tracking.carrier,
      trackingUrl: tracking.trackingUrl ?? universalTrackingUrl(tracking.trackingNumber),
      shippedAt: new Date(),
    },
    include: {
      offer: { select: { deliveryDaysMax: true } },
      items: { select: { quantity: true, variantLabel: true } },
      order: { include: { items: { select: { supplierOrderId: true } } } },
    },
  });
  if (so.costCents !== null) await recordPurchase(so.id);

  const parcels = [...new Set(so.order.items.map((i) => i.supplierOrderId).filter(Boolean))];
  await sendEmailOnce({
    type: "SHIPPED",
    dedupKey: `SHIPPED:${so.id}`,
    orderId: so.orderId,
    to: so.order.email,
    subject: `Commande ${so.order.number} expédiée${parcels.length > 1 ? ` (colis ${parcels.indexOf(so.id) + 1}/${parcels.length})` : ""}`,
    react: ShippedEmail({
      shop: await emailShop(),
      orderNumber: so.order.number,
      customerName: so.order.shippingName ?? "",
      parcelIndex: parcels.indexOf(so.id) + 1,
      parcelCount: parcels.length,
      itemsLabel: so.items.map((i) => `${i.quantity} × coussin taille ${i.variantLabel}`).join(", "),
      carrier: so.carrier,
      trackingNumber: so.trackingNumber!,
      trackingUrl: so.trackingUrl,
      deliveryEstimate: `au plus tard le ${dateFormat.format(new Date(Date.now() + so.offer.deliveryDaysMax * 86_400_000))}`,
    }),
  });
  await reconcileOrderStatus(so.orderId, actor);
}

/** Colis livré ; quand tous les colis le sont, la commande passe DELIVERED et le client est prévenu. */
export async function markParcelDelivered(supplierOrderId: string, actor: Actor): Promise<void> {
  const so = await db.supplierOrder.update({
    where: { id: supplierOrderId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  const status = await reconcileOrderStatus(so.orderId, actor);
  if (status !== "DELIVERED") return;
  const order = await db.order.findUniqueOrThrow({ where: { id: so.orderId } });
  await sendEmailOnce({
    type: "DELIVERED",
    dedupKey: `DELIVERED:${order.id}`,
    orderId: order.id,
    to: order.email,
    subject: `Commande ${order.number} livrée`,
    react: DeliveredEmail({
      shop: await emailShop(),
      orderNumber: order.number,
      customerName: order.shippingName ?? "",
    }),
  });
}

/**
 * Cron horaire : interroge les fournisseurs pour les envois en cours (statut, paiement, suivi,
 * livraison). Un fournisseur qui annule déclenche la bascule sur l'offre suivante.
 */
export async function syncTracking(now = new Date()): Promise<{ checked: number; errors: number }> {
  const due = await db.supplierOrder.findMany({
    where: {
      status: { in: ["AWAITING_SUPPLIER_PAYMENT", "PLACED", "SHIPPED"] },
      adapter: { not: "MANUAL" },
      externalOrderId: { not: null },
      OR: [{ lastPolledAt: null }, { lastPolledAt: { lt: new Date(now.getTime() - 50 * 60_000) } }],
    },
    orderBy: { lastPolledAt: { sort: "asc", nulls: "first" } },
    take: 50,
    include: { order: { select: { number: true } } },
  });

  let errors = 0;
  for (const so of due) {
    try {
      const adapter = getAdapter(so.adapter);
      const state = await adapter.getOrderStatus(so.externalOrderId!);
      await db.supplierOrder.update({ where: { id: so.id }, data: { lastPolledAt: now, lastError: null } });

      if (state === "CANCELLED") {
        await db.supplierOrder.update({
          where: { id: so.id },
          data: { status: "FAILED", lastError: "Annulée par le fournisseur" },
        });
        await db.orderItem.updateMany({ where: { supplierOrderId: so.id }, data: { supplierOrderId: null } });
        await notifyAdmin(
          `supplier-cancelled:${so.id}`,
          `Commande ${so.order.number} annulée par le fournisseur`,
          ["Bascule automatique sur l'offre suivante si elle existe ; sinon, la commande passe en erreur."],
        );
        await fulfillOrder(so.orderId);
        continue;
      }
      if (so.status === "AWAITING_SUPPLIER_PAYMENT" && state !== "AWAITING_PAYMENT" && state !== "UNKNOWN") {
        await db.supplierOrder.update({ where: { id: so.id }, data: { status: "PLACED" } });
        await recordPurchase(so.id);
        await reconcileOrderStatus(so.orderId, { type: "CRON" });
      }
      if (state === "SHIPPED" || state === "DELIVERED") {
        const tracking = await adapter.getTracking(so.externalOrderId!);
        if (tracking && so.status !== "SHIPPED") await markParcelShipped(so.id, tracking, { type: "CRON" });
        if (state === "DELIVERED" || tracking?.delivered) await markParcelDelivered(so.id, { type: "CRON" });
      }
    } catch (error) {
      errors += 1;
      await db.supplierOrder.update({
        where: { id: so.id },
        data: { lastPolledAt: now, lastError: `Suivi : ${(error as Error).message}`.slice(0, 500) },
      });
    }
  }
  return { checked: due.length, errors };
}
