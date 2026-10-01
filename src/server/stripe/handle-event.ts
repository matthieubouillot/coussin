import "server-only";
import type Stripe from "stripe";
import { db } from "@/server/db";
import { issueInvoiceInTx } from "@/server/invoices/issue-invoice";
import { finalizePaidOrder } from "@/server/orders/finalize-paid-order";
import { transitionOrder } from "@/server/orders/state-machine";
import { notifyAdmin } from "@/server/email/admin-alerts";

/**
 * Traitement des événements Stripe (déjà authentifiés par la signature dans la route).
 *
 * Idempotence : l'identifiant d'événement est inséré dans la même transaction que ses effets.
 * Un événement rejoué ne refait donc rien — sauf la finalisation (PDF, email), elle-même
 * idempotente, qui est relancée pour rattraper un éventuel échec précédent.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event, event.data.object);
    case "checkout.session.expired":
      return handleCheckoutExpired(event, event.data.object);
    default:
      // Les autres événements (remboursements, litiges) sont traités dans les phases suivantes.
      return;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

class AlreadyProcessed extends Error {}

async function recordEvent(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], event: Stripe.Event) {
  try {
    await tx.processedWebhookEvent.create({ data: { id: event.id, source: "stripe", type: event.type } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AlreadyProcessed();
    throw error;
  }
}

function splitName(full: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null };
}

async function handleCheckoutCompleted(event: Stripe.Event, session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) throw new Error(`Session ${session.id} sans référence de commande`);

  // Paiement par carte : toujours « paid » à ce stade. Toute autre valeur est anormale.
  if (session.payment_status !== "paid") {
    await notifyAdmin(`stripe-unpaid:${session.id}`, "Session Stripe terminée sans paiement", [
      `Session ${session.id}, statut de paiement : ${session.payment_status}.`,
    ]);
    return;
  }

  try {
    await db.$transaction(async (tx) => {
      await recordEvent(tx, event);

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error(`Commande ${orderId} introuvable pour la session ${session.id}`);
      if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
        throw new Error(`Session ${session.id} ne correspond pas à la commande ${order.number}`);
      }
      if (order.status !== "PENDING_PAYMENT") return; // Déjà payée (autre événement) : rien à refaire.

      const shipping = session.collected_information?.shipping_details;
      const details = session.customer_details;
      const email = details?.email?.trim().toLowerCase();
      if (!email || !shipping) throw new Error(`Session ${session.id} sans email ou adresse de livraison`);

      const { firstName, lastName } = splitName(shipping.name ?? details?.name);
      const customer = await tx.customer.upsert({
        where: { email },
        create: { email, firstName, lastName, phone: details?.phone ?? null },
        update: { firstName, lastName, phone: details?.phone ?? undefined, lastActivityAt: new Date() },
      });

      await transitionOrder(tx, {
        orderId: order.id,
        to: "PAID",
        actorType: "WEBHOOK",
        actorId: event.id,
        reason: "Paiement confirmé par Stripe",
        data: {
          customerId: customer.id,
          email,
          phone: details?.phone ?? null,
          shippingName: shipping.name,
          shippingLine1: shipping.address.line1,
          shippingLine2: shipping.address.line2,
          shippingPostalCode: shipping.address.postal_code,
          shippingCity: shipping.address.city,
          shippingCountry: shipping.address.country ?? "FR",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
          paidAt: new Date(event.created * 1000),
        },
      });

      if (order.promoCodeId) {
        await tx.promoCode.update({
          where: { id: order.promoCodeId },
          data: { usedCount: { increment: 1 } },
        });
      }

      // L'argent est encaissé : la commande est payée quoi qu'il arrive. Mais un écart de montant
      // signale un bug ou une manipulation : alerte immédiate, la facture n'est pas émise.
      if (session.amount_total !== order.totalCents || session.currency !== "eur") {
        await tx.orderNote.create({
          data: {
            orderId: order.id,
            authorId: "system",
            body: `ÉCART DE MONTANT : Stripe ${session.amount_total} ${session.currency}, commande ${order.totalCents} eur.`,
          },
        });
        return;
      }

      await issueInvoiceInTx(tx, order.id);
    });
  } catch (error) {
    if (!(error instanceof AlreadyProcessed)) throw error;
  }

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { totalCents: true, number: true },
  });
  if (session.amount_total !== order.totalCents) {
    await notifyAdmin(`amount-mismatch:${orderId}`, `Écart de montant sur la commande ${order.number}`, [
      `Stripe a encaissé ${session.amount_total} centimes, la commande en attendait ${order.totalCents}.`,
      "La facture n'a pas été émise. Vérifier la commande dans l'admin avant toute expédition.",
    ]);
    return;
  }
  await finalizePaidOrder(orderId);
}

async function handleCheckoutExpired(event: Stripe.Event, session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return;
  try {
    await db.$transaction(async (tx) => {
      await recordEvent(tx, event);
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (order?.status !== "PENDING_PAYMENT") return;
      await transitionOrder(tx, {
        orderId,
        to: "CANCELLED",
        actorType: "WEBHOOK",
        actorId: event.id,
        reason: "Session de paiement expirée sans paiement",
      });
    });
  } catch (error) {
    if (!(error instanceof AlreadyProcessed)) throw error;
  }
}
