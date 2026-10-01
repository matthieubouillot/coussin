import "server-only";
import { OrderConfirmationEmail } from "@/emails/OrderConfirmationEmail";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { sendEmailOnce } from "@/server/email/mailer";
import { emailShop } from "@/server/email/shop-identity";
import { formatEuros } from "@/lib/money";
import { ensureInvoicePdf } from "@/server/invoices/issue-invoice";
import { stripe } from "@/server/stripe/stripe";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

/**
 * Étapes qui suivent le paiement, hors transaction et rejouables sans risque :
 * mode de paiement, PDF de facture, email de confirmation, alerte admin.
 * (Phase 5 : c'est ici que la commande sera transmise au fournisseur.)
 */
export async function finalizePaidOrder(orderId: string): Promise<void> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, invoices: { where: { type: "INVOICE" } } },
  });
  if (order.status === "PENDING_PAYMENT" || order.status === "CANCELLED") return;

  if (!order.paymentMethodType && order.stripePaymentIntentId) {
    const intent = await stripe().paymentIntents.retrieve(order.stripePaymentIntentId, {
      expand: ["payment_method"],
    });
    const method = typeof intent.payment_method === "object" ? intent.payment_method : null;
    const type = method?.card?.wallet?.type ?? method?.type ?? null;
    if (type) {
      await db.order.update({ where: { id: order.id }, data: { paymentMethodType: type } });
      order.paymentMethodType = type;
    }
  }

  const invoice = order.invoices[0];
  if (!invoice) return; // Facture non émise (écart de montant) : traitement manuel, déjà signalé.
  const pdf = await ensureInvoicePdf(invoice.id);

  const shop = await emailShop();
  const settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
    select: { cgvVersion: true },
  });

  await sendEmailOnce({
    type: "ORDER_CONFIRMATION",
    dedupKey: `ORDER_CONFIRMATION:${order.id}`,
    orderId: order.id,
    to: order.email,
    subject: `Commande ${order.number} confirmée`,
    attachments: [
      { filename: `facture-${invoice.number}.pdf`, content: pdf.bytes, contentType: "application/pdf" },
    ],
    react: OrderConfirmationEmail({
      shop,
      orderNumber: order.number,
      customerName: order.shippingName ?? "",
      lines: order.items.map((i) => ({
        label: `${i.productName} — taille ${i.variantLabel}`,
        quantity: i.quantity,
        totalCents: i.unitPriceCents * i.quantity,
      })),
      discountCents: order.bundleDiscountCents + order.promoDiscountCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      vatExempt: order.taxMode === "FRANCHISE_293B",
      shippingAddress: [
        order.shippingName,
        order.shippingLine1,
        order.shippingLine2,
        [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" "),
      ].filter((l): l is string => Boolean(l)),
      deliveryEstimate: order.estimatedDeliveryMax
        ? `au plus tard le ${dateFormatter.format(order.estimatedDeliveryMax)}`
        : "sous quelques jours",
      cgvVersion: order.cgvVersion ?? settings?.cgvVersion ?? "",
    }),
  });

  await notifyAdmin(
    `new-order:${order.id}`,
    `Nouvelle commande ${order.number} — ${formatEuros(order.totalCents)}`,
    [
      order.items.map((i) => `${i.quantity} × ${i.variantLabel}`).join(", "),
      "Transmission au fournisseur : automatique à partir de la phase 5.",
    ],
  );
}
