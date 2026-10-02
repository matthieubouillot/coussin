import "server-only";
import { RefundEmail } from "@/emails/TransactionalEmails";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit/audit";
import { db } from "@/server/db";
import { sendEmailOnce } from "@/server/email/mailer";
import { emailShop } from "@/server/email/shop-identity";
import { cancelSupplierOrders } from "@/server/fulfillment/admin-operations";
import { ensureInvoicePdf, issueCreditNoteInTx } from "@/server/invoices/issue-invoice";
import { transitionOrder } from "@/server/orders/state-machine";
import { stripe } from "@/server/stripe/stripe";

export class RefundError extends Error {}

const REFUNDABLE: OrderStatus[] = [
  "PAID",
  "SENT_TO_SUPPLIER",
  "FULFILLMENT_ERROR",
  "SHIPPED",
  "DELIVERED",
  "REFUND_REQUESTED",
  "RETURNED",
  "PARTIALLY_REFUNDED",
  "CANCELLED",
];

/** Montant encore remboursable (remboursements en cours compris, pour éviter tout double remboursement). */
export async function refundableCents(orderId: string): Promise<number> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { totalCents: true } });
  const refunded = await db.refund.aggregate({
    where: { orderId, status: { in: ["PENDING", "SUCCEEDED"] } },
    _sum: { amountCents: true },
  });
  return order.totalCents - (refunded._sum.amountCents ?? 0);
}

/**
 * Remboursement total ou partiel via Stripe, avec avoir, transitions de statut, email et audit.
 * Le remboursement Stripe est appelé avec une clé d'idempotence : un double clic ou une nouvelle
 * tentative ne rembourse jamais deux fois.
 */
export async function refundOrder(params: {
  orderId: string;
  amountCents: number;
  reason: string;
  adminId: string;
}): Promise<{ refundId: string; creditNoteNumber: string }> {
  const order = await db.order.findUniqueOrThrow({ where: { id: params.orderId } });
  if (!REFUNDABLE.includes(order.status) || !order.stripePaymentIntentId || !order.paidAt) {
    throw new RefundError("Cette commande ne peut pas être remboursée.");
  }
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
    throw new RefundError("Montant invalide.");
  }

  // Verrou applicatif : le montant disponible est recalculé et réservé (PENDING) dans une transaction sérialisable.
  const refund = await db.$transaction(
    async (tx) => {
      const refunded = await tx.refund.aggregate({
        where: { orderId: order.id, status: { in: ["PENDING", "SUCCEEDED"] } },
        _sum: { amountCents: true },
      });
      const available = order.totalCents - (refunded._sum.amountCents ?? 0);
      if (params.amountCents > available) {
        throw new RefundError(
          `Montant supérieur au restant remboursable (${(available / 100).toFixed(2)} €).`,
        );
      }
      return tx.refund.create({
        data: {
          orderId: order.id,
          amountCents: params.amountCents,
          reason: params.reason,
          adminId: params.adminId,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  let stripeRefund;
  try {
    stripeRefund = await stripe().refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        amount: params.amountCents,
        reason: "requested_by_customer",
        metadata: { orderId: order.id, refundId: refund.id },
      },
      { idempotencyKey: `refund-${refund.id}` },
    );
  } catch (error) {
    await db.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } });
    await audit("order.refund.failed", { actorId: params.adminId, targetType: "order", targetId: order.id });
    throw new RefundError(
      `Stripe a refusé le remboursement : ${error instanceof Error ? error.message : "erreur"}`,
    );
  }
  if (stripeRefund.status === "failed" || stripeRefund.status === "canceled") {
    await db.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED", stripeRefundId: stripeRefund.id },
    });
    throw new RefundError("Stripe a refusé le remboursement.");
  }

  const creditNoteId = await db.$transaction(async (tx) => {
    const noteId = await issueCreditNoteInTx(tx, {
      orderId: order.id,
      amountCents: params.amountCents,
      reason: params.reason,
    });
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "SUCCEEDED",
        stripeRefundId: stripeRefund.id,
        refundedAt: new Date(),
        creditNoteId: noteId,
      },
    });
    const totalRefunded =
      (
        await tx.refund.aggregate({
          where: { orderId: order.id, status: "SUCCEEDED" },
          _sum: { amountCents: true },
        })
      )._sum.amountCents ?? 0;
    const full = totalRefunded >= order.totalCents;
    await moveToRefundedState(tx, order.id, full, params.adminId, params.reason);
    if (full) {
      await tx.withdrawalRequest.updateMany({
        where: { orderId: order.id, status: { in: ["RECEIVED", "ACCEPTED", "RETURN_RECEIVED"] } },
        data: { status: "REFUNDED" },
      });
    }
    return noteId;
  });

  const creditNote = await db.invoice.findUniqueOrThrow({
    where: { id: creditNoteId },
    select: { number: true },
  });
  await audit("order.refund", {
    actorId: params.adminId,
    targetType: "order",
    targetId: order.id,
    metadata: { amountCents: params.amountCents, creditNote: creditNote.number },
  });

  const pdf = await ensureInvoicePdf(creditNoteId);
  await sendEmailOnce({
    type: "REFUND",
    dedupKey: `REFUND:${refund.id}`,
    orderId: order.id,
    to: order.email,
    subject: `Remboursement de votre commande ${order.number}`,
    attachments: [
      { filename: `avoir-${creditNote.number}.pdf`, content: pdf.bytes, contentType: "application/pdf" },
    ],
    react: RefundEmail({
      shop: await emailShop(),
      orderNumber: order.number,
      customerName: order.shippingName ?? "",
      amountCents: params.amountCents,
      creditNoteNumber: creditNote.number,
    }),
  });
  return { refundId: refund.id, creditNoteNumber: creditNote.number };
}

/** Enchaîne les transitions autorisées vers REFUNDED ou PARTIALLY_REFUNDED. */
async function moveToRefundedState(
  tx: Prisma.TransactionClient,
  orderId: string,
  full: boolean,
  adminId: string,
  reason: string,
) {
  const { status } = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  const base = { orderId, actorType: "ADMIN" as const, actorId: adminId, reason };

  if (status === "CANCELLED") {
    if (full) await transitionOrder(tx, { ...base, to: "REFUNDED" });
    return; // Remboursement partiel d'une commande annulée : le statut reste « annulée ».
  }
  if (!["REFUND_REQUESTED", "RETURNED"].includes(status)) {
    await transitionOrder(tx, { ...base, to: "REFUND_REQUESTED" });
  }
  await transitionOrder(tx, { ...base, to: full ? "REFUNDED" : "PARTIALLY_REFUNDED" });
}

/**
 * Annulation par l'admin : commande non payée → simple annulation ; commande payée non expédiée
 * → annulation puis remboursement intégral.
 */
export async function cancelOrder(params: {
  orderId: string;
  reason: string;
  adminId: string;
}): Promise<void> {
  const order = await db.order.findUniqueOrThrow({ where: { id: params.orderId } });
  if (!["PENDING_PAYMENT", "PAID", "FULFILLMENT_ERROR", "SENT_TO_SUPPLIER"].includes(order.status)) {
    throw new RefundError("Commande déjà expédiée : utiliser le remboursement après retour.");
  }
  await db.$transaction((tx) =>
    transitionOrder(tx, {
      orderId: order.id,
      to: "CANCELLED",
      actorType: "ADMIN",
      actorId: params.adminId,
      reason: params.reason,
    }),
  );
  await audit("order.cancel", { actorId: params.adminId, targetType: "order", targetId: order.id });
  await cancelSupplierOrders(order.id, order.number);
  if (order.status !== "PENDING_PAYMENT") {
    const amount = await refundableCents(order.id);
    if (amount > 0)
      await refundOrder({
        orderId: order.id,
        amountCents: amount,
        reason: params.reason,
        adminId: params.adminId,
      });
  }
}
