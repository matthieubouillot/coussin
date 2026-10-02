import "server-only";
import { DelayNoticeEmail } from "@/emails/TransactionalEmails";
import type { Prisma, SupplierOffer, SupplierOrder } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { sendEmailOnce } from "@/server/email/mailer";
import { emailShop } from "@/server/email/shop-identity";
import { buildShippingAddress } from "@/server/fulfillment/address";
import { markFulfillmentError, reconcileOrderStatus } from "@/server/fulfillment/order-status";
import {
  MAX_ATTEMPTS,
  marginBps,
  nextCandidate,
  nextRetryAt,
  usdCentsToEurCents,
} from "@/server/fulfillment/policy";
import { recordPurchase } from "@/server/fulfillment/purchases";
import { getAdapter } from "@/server/fulfillment/registry";
import { SupplierError, type ShippingAddress, type StockAndPrice } from "@/server/fulfillment/types";

/**
 * Transmission d'une commande payée aux fournisseurs (cahier des charges §5.2).
 *
 * Idempotent et rejouable : appelé par le job QStash, le cron de rattrapage ou l'admin, autant de
 * fois que nécessaire. L'état vit en base (SupplierOrder) ; chaque envoi est d'abord « réservé »
 * (QUEUED → PLACING par mise à jour conditionnelle) : deux exécutions simultanées ne peuvent pas
 * envoyer la même commande deux fois.
 *
 * Retourne la date de la prochaine tentative programmée, s'il y en a une.
 */
export async function fulfillOrder(orderId: string): Promise<{ nextRunAt: Date | null }> {
  for (let pass = 0; pass < 10; pass++) {
    const progressed = await runPass(orderId);
    if (!progressed) break;
  }
  await reconcileOrderStatus(orderId, { type: "SYSTEM" });

  const next = await db.supplierOrder.findFirst({
    where: { orderId, status: "QUEUED", nextAttemptAt: { not: null } },
    orderBy: { nextAttemptAt: "asc" },
    select: { nextAttemptAt: true },
  });
  return { nextRunAt: next?.nextAttemptAt ?? null };
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function loadOrder(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { variant: { include: { offers: true } }, supplierOrder: true } },
      supplierOrders: { include: { offer: true } },
    },
  });
}

/** Un passage : crée les envois manquants puis tente ceux qui sont dus. Retourne true si quelque chose a bougé. */
async function runPass(orderId: string): Promise<boolean> {
  const order = await loadOrder(orderId);
  if (!order || !["PAID", "SENT_TO_SUPPLIER", "FULFILLMENT_ERROR"].includes(order.status)) return false;

  const address = buildShippingAddress(order);
  if (!address) {
    await markFulfillmentError(order.id, "Adresse ou téléphone de livraison incomplet");
    return false;
  }

  let progressed = false;
  for (const item of order.items) {
    const active =
      item.supplierOrder && !["FAILED", "CANCELLED"].includes(item.supplierOrder.status)
        ? item.supplierOrder
        : null;
    if (active) continue;
    progressed = (await openSupplierOrder(order, item)) || progressed;
  }

  const fresh = await loadOrder(orderId);
  const now = new Date();
  for (const item of fresh?.items ?? []) {
    const so = item.supplierOrder;
    if (!so || so.status !== "QUEUED" || (so.nextAttemptAt && so.nextAttemptAt > now)) continue;
    const offer = item.variant.offers.find((o) => o.id === so.offerId);
    if (!offer) continue;
    progressed = (await attemptPlacement(fresh!, so, offer, item, address)) || progressed;
  }
  return progressed;
}

/** Choisit l'offre suivante pour un article (bascule si une offre a déjà échoué) et crée l'envoi. */
async function openSupplierOrder(order: LoadedOrder, item: LoadedOrder["items"][number]): Promise<boolean> {
  const failedOfferIds = new Set(
    order.supplierOrders
      .filter((so) => so.status === "FAILED" && so.offer.variantId === item.variantId)
      .map((so) => so.offerId),
  );
  const offer = nextCandidate(item.variant.offers, failedOfferIds);
  if (!offer) {
    await markFulfillmentError(
      order.id,
      `Plus aucune offre fournisseur disponible pour la taille ${item.variantLabel}`,
    );
    return false;
  }

  let supplierOrder: SupplierOrder;
  try {
    supplierOrder = await db.supplierOrder.create({
      data: {
        orderId: order.id,
        offerId: offer.id,
        adapter: offer.adapter,
        idempotencyKey: `${item.id}:${offer.id}`,
        status: "QUEUED",
      },
    });
  } catch (error) {
    // Une autre exécution a créé cet envoi au même moment : on le réutilise.
    if (!(typeof error === "object" && error && "code" in error && error.code === "P2002")) throw error;
    supplierOrder = await db.supplierOrder.findUniqueOrThrow({
      where: { idempotencyKey: `${item.id}:${offer.id}` },
    });
  }
  await db.orderItem.update({ where: { id: item.id }, data: { supplierOrderId: supplierOrder.id } });

  if (failedOfferIds.size > 0) await onFallback(order, item.variantLabel, offer);
  return true;
}

/** Bascule sur un fournisseur de secours : alerte admin, et email au client si le délai s'allonge (Q12). */
async function onFallback(order: LoadedOrder, variantLabel: string, offer: SupplierOffer): Promise<void> {
  await notifyAdmin(`fallback:${order.id}:${offer.id}`, `Bascule fournisseur — commande ${order.number}`, [
    `Taille ${variantLabel} : envoi sur l'offre de secours « ${offer.supplierName} » (priorité ${offer.priority}).`,
    "Vérifier qu'un fournisseur de secours reste disponible pour les prochaines commandes.",
  ]);

  const newLatest = new Date(Date.now() + offer.deliveryDaysMax * 86_400_000);
  if (order.estimatedDeliveryMax && newLatest > order.estimatedDeliveryMax) {
    const format = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      timeZone: "Europe/Paris",
    });
    await sendEmailOnce({
      type: "DELAY_NOTICE",
      dedupKey: `DELAY_NOTICE:${order.id}`,
      orderId: order.id,
      to: order.email,
      subject: `Commande ${order.number} : nouveau délai de livraison`,
      react: DelayNoticeEmail({
        shop: await emailShop(),
        orderNumber: order.number,
        customerName: order.shippingName ?? "",
        newEstimate: `au plus tard le ${format.format(newLatest)}`,
      }),
    });
    await db.orderNote.create({
      data: {
        orderId: order.id,
        authorId: "system",
        body: `Délai rallongé (fournisseur de secours) : client prévenu, nouvelle date max ${newLatest.toISOString().slice(0, 10)}.`,
      },
    });
  }
}

async function attemptPlacement(
  order: LoadedOrder,
  so: SupplierOrder,
  offer: SupplierOffer,
  item: LoadedOrder["items"][number],
  address: ShippingAddress,
): Promise<boolean> {
  // Réservation : seule l'exécution qui réussit cette mise à jour conditionnelle envoie la commande.
  const claimed = await db.supplierOrder.updateMany({
    where: { id: so.id, status: "QUEUED" },
    data: { status: "PLACING", claimedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return false;
  const attempts = so.attempts + 1;
  const adapter = getAdapter(offer.adapter);

  try {
    if (offer.adapter !== "MANUAL") {
      const live = await adapter.getStockAndPrice(offer);
      await recordLiveOffer(offer, live, item.unitPriceCents);
      if (live.stock !== null && live.stock < item.quantity) {
        throw new SupplierError("OUT_OF_STOCK", `Stock fournisseur insuffisant (${live.stock})`);
      }
    }

    const result = await adapter.placeOrder({ reference: so.id, offer, quantity: item.quantity, address });

    const costCents =
      result.totalCostCents ?? (offer.purchaseCostCents + offer.shippingCostCents) * item.quantity;
    const status =
      result.payment === "PAID"
        ? "PLACED"
        : result.payment === "AWAITING_PAYMENT"
          ? "AWAITING_SUPPLIER_PAYMENT"
          : "MANUAL_ACTION_REQUIRED";
    await db.$transaction([
      db.supplierOrder.update({
        where: { id: so.id },
        data: {
          status,
          externalOrderId: result.externalOrderId,
          costCents,
          lastError: null,
          nextAttemptAt: null,
        },
      }),
      db.orderItem.update({
        where: { id: item.id },
        data: { unitCostCents: Math.round(costCents / item.quantity) },
      }),
    ]);
    if (status === "PLACED") await recordPurchase(so.id);
    if (status === "AWAITING_SUPPLIER_PAYMENT") {
      await notifyAdmin(`to-pay:${so.id}`, `Commande à payer sur AliExpress — ${order.number}`, [
        `Commande fournisseur n° ${result.externalOrderId} créée mais non payée (paiement automatique indisponible ou refusé).`,
        "La payer depuis « Mes commandes » sur AliExpress ; le statut se mettra à jour automatiquement.",
      ]);
    }
    if (status === "MANUAL_ACTION_REQUIRED")
      await alertManual(order.number, so.id, `Fournisseur manuel « ${offer.supplierName} ».`);
    return true;
  } catch (error) {
    await handleFailure(order.number, so, attempts, item.id, error);
    return true;
  }
}

async function handleFailure(
  orderNumber: string,
  so: SupplierOrder,
  attempts: number,
  itemId: string,
  error: unknown,
): Promise<void> {
  const kind = error instanceof SupplierError ? error.kind : "AMBIGUOUS";
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  const update = (data: Prisma.SupplierOrderUpdateInput) =>
    db.supplierOrder.update({ where: { id: so.id }, data: { lastError: message, ...data } });

  if (kind === "TRANSIENT" && attempts < MAX_ATTEMPTS) {
    await update({ status: "QUEUED", nextAttemptAt: nextRetryAt(attempts) });
    return;
  }
  if (kind === "AMBIGUOUS") {
    await update({ status: "NEEDS_CHECK" });
    await notifyAdmin(`needs-check:${so.id}`, `Commande ${orderNumber} : envoi au fournisseur incertain`, [
      `Réponse incertaine du fournisseur : ${message}.`,
      "Vérifier dans le compte fournisseur si la commande existe AVANT de relancer (aucune relance automatique, pour éviter un doublon).",
    ]);
    return;
  }
  if (kind === "NOT_CONFIGURED" || kind === "NOT_SUPPORTED") {
    await update({ status: "MANUAL_ACTION_REQUIRED" });
    await alertManual(orderNumber, so.id, message);
    return;
  }
  // Rupture, refus définitif ou réessais épuisés : l'envoi est abandonné, l'article bascule sur l'offre suivante.
  await update({
    status: "FAILED",
    nextAttemptAt: null,
    lastError: kind === "TRANSIENT" ? `${MAX_ATTEMPTS} tentatives échouées : ${message}` : message,
  });
  await db.orderItem.update({ where: { id: itemId }, data: { supplierOrderId: null } });
}

async function alertManual(orderNumber: string, supplierOrderId: string, reason: string): Promise<void> {
  await notifyAdmin(`manual:${supplierOrderId}`, `Commande ${orderNumber} à passer manuellement`, [
    reason,
    "Ouvrir la commande dans l'admin : bouton « Passer chez le fournisseur », puis saisir la référence et le suivi.",
  ]);
}

/** Met à jour stock et coût observés à l'instant de la commande ; alerte si la marge passe sous le seuil. */
async function recordLiveOffer(
  offer: SupplierOffer,
  live: StockAndPrice,
  salePriceCents: number,
): Promise<void> {
  const settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
    select: { usdToEurMicros: true, marginAlertThresholdBps: true },
  });
  const unitCostEur =
    live.unitCost === null
      ? null
      : live.currency === "USD"
        ? settings?.usdToEurMicros
          ? usdCentsToEurCents(live.unitCost, settings.usdToEurMicros)
          : null
        : live.unitCost;

  await db.supplierOffer.update({
    where: { id: offer.id },
    data: {
      lastKnownStock: live.stock,
      lastSyncedAt: new Date(),
      lastSyncError: null,
      ...(unitCostEur !== null ? { purchaseCostCents: unitCostEur } : {}),
    },
  });
  if (unitCostEur !== null && unitCostEur !== offer.purchaseCostCents) {
    await db.supplierCostHistory.create({
      data: {
        offerId: offer.id,
        purchaseCostCents: unitCostEur,
        shippingCostCents: offer.shippingCostCents,
        stock: live.stock,
      },
    });
  }
  if (
    unitCostEur !== null &&
    settings &&
    marginBps(salePriceCents, unitCostEur, offer.shippingCostCents) < settings.marginAlertThresholdBps
  ) {
    await notifyAdmin(
      `margin:${offer.id}:${unitCostEur}`,
      `Marge sous le seuil — offre ${offer.supplierName}`,
      [
        `Coût d'achat ${(unitCostEur / 100).toFixed(2)} € + port ${(offer.shippingCostCents / 100).toFixed(2)} € pour un prix de vente de ${(salePriceCents / 100).toFixed(2)} €.`,
        "Le prix de vente n'est jamais modifié automatiquement.",
      ],
    );
  }
}
