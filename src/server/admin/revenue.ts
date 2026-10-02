import "server-only";
import { db } from "@/server/db";
import type { Period } from "@/lib/paris-time";

/**
 * Chiffre d'affaires encaissé sur une période (micro-entreprise : recettes encaissées).
 * = paiements reçus − remboursements effectués, chacun à sa propre date.
 */
export async function cashedRevenue(
  period: Period,
): Promise<{ grossCents: number; refundsCents: number; netCents: number; orders: number }> {
  const [paid, refunds] = await Promise.all([
    db.order.aggregate({
      where: { paidAt: { gte: period.start, lt: period.end } },
      _sum: { totalCents: true },
      _count: true,
    }),
    db.refund.aggregate({
      where: { status: "SUCCEEDED", refundedAt: { gte: period.start, lt: period.end } },
      _sum: { amountCents: true },
    }),
  ]);
  const grossCents = paid._sum.totalCents ?? 0;
  const refundsCents = refunds._sum.amountCents ?? 0;
  return { grossCents, refundsCents, netCents: grossCents - refundsCents, orders: paid._count };
}

/**
 * Marge brute estimée : encaissements − coût des articles (coût réel s'il est connu, sinon coût
 * actuel de l'offre fournisseur principale) − remboursements. Indicatif, hors frais Stripe.
 */
export async function estimatedGrossMargin(period: Period): Promise<number> {
  const orders = await db.order.findMany({
    where: { paidAt: { gte: period.start, lt: period.end } },
    select: {
      totalCents: true,
      items: {
        select: {
          quantity: true,
          unitCostCents: true,
          variant: { select: { offers: { where: { active: true }, orderBy: { priority: "asc" }, take: 1 } } },
        },
      },
    },
  });
  const revenue = await cashedRevenue(period);
  const costs = orders
    .flatMap((o) => o.items)
    .reduce((sum, item) => {
      const offer = item.variant.offers[0];
      const unit = item.unitCostCents ?? (offer ? offer.purchaseCostCents + offer.shippingCostCents : 0);
      return sum + unit * item.quantity;
    }, 0);
  return revenue.netCents - costs;
}
