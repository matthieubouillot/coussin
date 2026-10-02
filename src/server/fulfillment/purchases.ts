import "server-only";
import { db } from "@/server/db";

const PAYMENT_LABEL = {
  ALIEXPRESS: "Paiement AliExpress",
  CJ: "Solde CJ Dropshipping",
  MANUAL: "Saisi manuellement",
} as const;

/**
 * Inscrit au registre des achats une commande fournisseur payée (une ligne par envoi, idempotent).
 * Montant = coût réellement facturé s'il est connu, sinon coût de l'offre au moment de la commande.
 */
export async function recordPurchase(supplierOrderId: string, paymentMethod?: string): Promise<void> {
  const so = await db.supplierOrder.findUniqueOrThrow({
    where: { id: supplierOrderId },
    include: {
      offer: true,
      items: { select: { quantity: true, productName: true, variantLabel: true } },
      order: { select: { number: true } },
    },
  });
  if (so.costCents === null) return;
  const description =
    so.items.map((i) => `${i.quantity} × ${i.productName} — ${i.variantLabel}`).join(", ") ||
    `Commande ${so.order.number}`;
  await db.purchaseRecord.upsert({
    where: { supplierOrderId },
    create: {
      supplierOrderId,
      date: new Date(),
      supplierName: so.offer.supplierName,
      reference: so.externalOrderId ?? so.id,
      description: `${description} (commande client ${so.order.number})`,
      amountCents: so.costCents,
      paymentMethod: paymentMethod ?? PAYMENT_LABEL[so.adapter],
    },
    update: {},
  });
}
