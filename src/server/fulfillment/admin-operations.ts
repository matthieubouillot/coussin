import "server-only";
import type { SupplierOrderStatus } from "@/generated/prisma/client";
import { audit } from "@/server/audit/audit";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { fulfillOrder } from "@/server/fulfillment/dispatch";
import { reconcileOrderStatus } from "@/server/fulfillment/order-status";
import { recordPurchase } from "@/server/fulfillment/purchases";
import { getAdapter } from "@/server/fulfillment/registry";
import { markParcelDelivered, markParcelShipped } from "@/server/fulfillment/tracking";

// Opérations manuelles sur les commandes fournisseur (filet de sécurité), toutes journalisées.

export class SupplierOperationError extends Error {}

async function requireStatus(id: string, allowed: SupplierOrderStatus[]) {
  const so = await db.supplierOrder.findUniqueOrThrow({ where: { id } });
  if (!allowed.includes(so.status))
    throw new SupplierOperationError(`Action impossible dans l'état ${so.status}.`);
  return so;
}

/** Relance le traitement automatique d'une commande (après ajout d'une offre, correction…). */
export async function relaunchFulfillment(orderId: string, adminId: string): Promise<void> {
  await audit("fulfillment.relaunch", { actorId: adminId, targetType: "order", targetId: orderId });
  await fulfillOrder(orderId);
}

/** Envoi incertain : l'admin a vérifié chez le fournisseur qu'aucune commande n'existe → nouvel envoi. */
export async function retryAfterCheck(supplierOrderId: string, adminId: string): Promise<void> {
  const so = await requireStatus(supplierOrderId, ["NEEDS_CHECK"]);
  await db.supplierOrder.update({
    where: { id: so.id },
    data: { status: "QUEUED", attempts: 0, nextAttemptAt: null, claimedAt: null },
  });
  await audit("fulfillment.retry_after_check", {
    actorId: adminId,
    targetType: "supplierOrder",
    targetId: so.id,
  });
  await fulfillOrder(so.orderId);
}

export async function switchToManual(supplierOrderId: string, adminId: string): Promise<void> {
  const so = await requireStatus(supplierOrderId, ["QUEUED", "NEEDS_CHECK"]);
  await db.supplierOrder.update({
    where: { id: so.id },
    data: { status: "MANUAL_ACTION_REQUIRED", nextAttemptAt: null },
  });
  await audit("fulfillment.switch_manual", {
    actorId: adminId,
    targetType: "supplierOrder",
    targetId: so.id,
  });
}

/** Commande passée à la main chez le fournisseur (ou trouvée lors d'une vérification). */
export async function recordManualPlacement(
  supplierOrderId: string,
  input: { externalOrderId: string; costCents: number; paid: boolean },
  adminId: string,
): Promise<void> {
  const so = await requireStatus(supplierOrderId, ["MANUAL_ACTION_REQUIRED", "NEEDS_CHECK", "QUEUED"]);
  const items = await db.orderItem.findMany({
    where: { supplierOrderId: so.id },
    select: { id: true, quantity: true },
  });
  await db.$transaction([
    db.supplierOrder.update({
      where: { id: so.id },
      data: {
        status: input.paid ? "PLACED" : "AWAITING_SUPPLIER_PAYMENT",
        externalOrderId: input.externalOrderId,
        costCents: input.costCents,
        lastError: null,
      },
    }),
    ...items.map((i) =>
      db.orderItem.update({
        where: { id: i.id },
        data: { unitCostCents: Math.round(input.costCents / i.quantity) },
      }),
    ),
  ]);
  if (input.paid) await recordPurchase(so.id, "Saisi manuellement");
  await audit("fulfillment.manual_placement", {
    actorId: adminId,
    targetType: "supplierOrder",
    targetId: so.id,
    metadata: { costCents: input.costCents },
  });
  await reconcileOrderStatus(so.orderId, { type: "ADMIN", id: adminId });
}

export async function confirmSupplierPayment(supplierOrderId: string, adminId: string): Promise<void> {
  const so = await requireStatus(supplierOrderId, ["AWAITING_SUPPLIER_PAYMENT"]);
  await db.supplierOrder.update({ where: { id: so.id }, data: { status: "PLACED" } });
  await recordPurchase(so.id);
  await audit("fulfillment.supplier_paid", {
    actorId: adminId,
    targetType: "supplierOrder",
    targetId: so.id,
  });
  await reconcileOrderStatus(so.orderId, { type: "ADMIN", id: adminId });
}

export async function recordManualTracking(
  supplierOrderId: string,
  input: { trackingNumber: string; carrier: string | null; trackingUrl: string | null },
  adminId: string,
): Promise<void> {
  await requireStatus(supplierOrderId, ["PLACED", "AWAITING_SUPPLIER_PAYMENT", "SHIPPED"]);
  await markParcelShipped(supplierOrderId, input, { type: "ADMIN", id: adminId });
  await audit("fulfillment.manual_tracking", {
    actorId: adminId,
    targetType: "supplierOrder",
    targetId: supplierOrderId,
  });
}

export async function recordManualDelivery(supplierOrderId: string, adminId: string): Promise<void> {
  await requireStatus(supplierOrderId, ["SHIPPED"]);
  await markParcelDelivered(supplierOrderId, { type: "ADMIN", id: adminId });
  await audit("fulfillment.manual_delivery", {
    actorId: adminId,
    targetType: "supplierOrder",
    targetId: supplierOrderId,
  });
}

/**
 * À l'annulation d'une commande client : annule les envois fournisseur. Ce qui n'a pas encore été
 * envoyé est simplement abandonné ; ce qui l'a été est annulé via l'API si possible, sinon l'admin
 * est alerté pour le faire à la main.
 */
export async function cancelSupplierOrders(orderId: string, orderNumber: string): Promise<void> {
  const supplierOrders = await db.supplierOrder.findMany({
    where: {
      orderId,
      status: {
        in: ["QUEUED", "MANUAL_ACTION_REQUIRED", "NEEDS_CHECK", "AWAITING_SUPPLIER_PAYMENT", "PLACED"],
      },
    },
  });
  for (const so of supplierOrders) {
    if (["QUEUED", "MANUAL_ACTION_REQUIRED"].includes(so.status) || !so.externalOrderId) {
      await db.supplierOrder.update({
        where: { id: so.id },
        data: { status: "CANCELLED", nextAttemptAt: null },
      });
      if (so.status === "NEEDS_CHECK") {
        await notifyAdmin(`cancel-check:${so.id}`, `Commande ${orderNumber} annulée : envoi incertain`, [
          "Vérifier chez le fournisseur qu'aucune commande n'a été créée, sinon l'annuler.",
        ]);
      }
      continue;
    }
    try {
      await getAdapter(so.adapter).cancelOrder(so.externalOrderId);
      await db.supplierOrder.update({ where: { id: so.id }, data: { status: "CANCELLED" } });
    } catch (error) {
      await db.orderNote.create({
        data: {
          orderId,
          authorId: "system",
          body: `Annulation fournisseur à faire à la main (${so.externalOrderId}) : ${(error as Error).message}`,
        },
      });
      await notifyAdmin(`cancel-supplier:${so.id}`, `Annuler la commande fournisseur ${so.externalOrderId}`, [
        `La commande client ${orderNumber} a été annulée et remboursée, mais l'annulation chez le fournisseur n'a pas pu être faite automatiquement.`,
        (error as Error).message,
      ]);
    }
  }
}
