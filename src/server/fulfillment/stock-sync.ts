import "server-only";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { marginBps, usdCentsToEurCents } from "@/server/fulfillment/policy";
import { getAdapter } from "@/server/fulfillment/registry";

/**
 * Synchronisation stock et prix d'achat (cron quotidien + bouton admin), cahier des charges §5.3 :
 * historique des coûts, alerte stock bas sur le fournisseur principal, alerte si toutes les offres
 * d'une taille sont épuisées (la taille passe alors automatiquement « en rupture »), alerte de marge.
 * Le prix de vente n'est jamais modifié automatiquement.
 */
export async function syncStockAndPrices(): Promise<{ synced: number; failed: number }> {
  const settings = await db.shopSettings.findUnique({ where: { id: "singleton" } });
  const variants = await db.variant.findMany({
    where: { active: true },
    include: { offers: { where: { active: true }, orderBy: { priority: "asc" } } },
  });
  const day = new Date().toISOString().slice(0, 10);
  let synced = 0;
  let failed = 0;

  for (const variant of variants) {
    for (const offer of variant.offers) {
      if (offer.adapter === "MANUAL") continue;
      try {
        const live = await getAdapter(offer.adapter).getStockAndPrice(offer);
        let costEur: number | null = live.unitCost;
        if (live.unitCost !== null && live.currency === "USD") {
          costEur = settings?.usdToEurMicros
            ? usdCentsToEurCents(live.unitCost, settings.usdToEurMicros)
            : null;
          if (costEur === null) {
            await notifyAdmin(`usd-rate-missing:${day}`, "Taux USD → EUR non renseigné", [
              "Les prix CJ sont en dollars : renseigner le taux dans les réglages pour suivre les coûts et les marges.",
            ]);
          }
        }
        const updated = await db.supplierOffer.update({
          where: { id: offer.id },
          data: {
            lastKnownStock: live.stock,
            lastSyncedAt: new Date(),
            lastSyncError: null,
            ...(costEur !== null ? { purchaseCostCents: costEur } : {}),
          },
        });
        await db.supplierCostHistory.create({
          data: {
            offerId: offer.id,
            purchaseCostCents: updated.purchaseCostCents,
            shippingCostCents: updated.shippingCostCents,
            stock: live.stock,
          },
        });
        if (
          settings &&
          costEur !== null &&
          marginBps(variant.priceCents, costEur, offer.shippingCostCents) < settings.marginAlertThresholdBps
        ) {
          await notifyAdmin(
            `margin:${offer.id}:${costEur}`,
            `Marge sous le seuil — taille ${variant.label}`,
            [
              `Offre « ${offer.supplierName} » : achat ${(costEur / 100).toFixed(2)} € + port ${(offer.shippingCostCents / 100).toFixed(2)} € pour ${(variant.priceCents / 100).toFixed(2)} € de vente.`,
              "Le prix de vente n'a pas été modifié.",
            ],
          );
        }
        synced += 1;
      } catch (error) {
        failed += 1;
        await db.supplierOffer.update({
          where: { id: offer.id },
          data: { lastSyncError: (error as Error).message.slice(0, 500) },
        });
      }
    }

    const fresh = await db.supplierOffer.findMany({
      where: { variantId: variant.id, active: true },
      orderBy: { priority: "asc" },
    });
    const primary = fresh[0];
    if (
      primary &&
      primary.lastKnownStock !== null &&
      settings &&
      primary.lastKnownStock < settings.lowStockThreshold
    ) {
      await notifyAdmin(
        `low-stock:${primary.id}:${day}`,
        `Stock bas chez le fournisseur principal — taille ${variant.label}`,
        [
          `« ${primary.supplierName} » : ${primary.lastKnownStock} pièce(s) restante(s) (seuil ${settings.lowStockThreshold}).`,
          `Fournisseurs de secours actifs : ${fresh.length - 1}. Ajouter ou vérifier une offre de secours.`,
        ],
      );
    }
    if (fresh.length > 0 && fresh.every((o) => o.lastKnownStock !== null && o.lastKnownStock <= 0)) {
      await notifyAdmin(
        `sold-out:${variant.id}:${day}`,
        `Taille ${variant.label} en rupture chez tous les fournisseurs`,
        ["La taille est affichée « en rupture » et n'est plus achetable."],
      );
    }
  }
  return { synced, failed };
}
