import "server-only";
import { OrderConfirmationEmail } from "@/emails/OrderConfirmationEmail";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";
import { sendEmailOnce } from "@/server/email/mailer";
import { emailShop } from "@/server/email/shop-identity";
import { formatEuros } from "@/lib/money";
import { ensureInvoicePdf } from "@/server/invoices/issue-invoice";
import { Prisma } from "@/generated/prisma/client";
import { scheduleFulfillment } from "@/server/fulfillment/queue";
import { marketingContextSchema } from "@/server/marketing/context";
import { sendServerEvent } from "@/server/marketing/destinations";
import { stripe } from "@/server/stripe/stripe";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

/**
 * Étapes qui suivent le paiement, hors transaction et rejouables sans risque :
 * mode de paiement, PDF de facture, email de confirmation, alerte admin, transmission au fournisseur.
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
      "Transmission au fournisseur en cours (automatique).",
    ],
  );

  await sendPurchaseEvent(order);

  // L'envoi au fournisseur est asynchrone : il ne doit jamais retarder ni faire échouer le webhook.
  if (order.status === "PAID") await scheduleFulfillment(order.id);
}

/**
 * Achat envoyé aux régies (même eventId que le pixel de la page de confirmation), uniquement si le
 * client avait consenti. Le contexte publicitaire est ensuite effacé : il ne sert qu'une fois.
 */
async function sendPurchaseEvent(order: {
  id: string;
  adsConsent: boolean;
  marketingContext: Prisma.JsonValue;
  marketingEventId: string | null;
  totalCents: number;
  email: string;
  phone: string | null;
  customerId: string | null;
  items: {
    sku: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPriceCents: number;
  }[];
}): Promise<void> {
  const context = marketingContextSchema.safeParse(order.marketingContext);
  if (!order.adsConsent || !context.success || !order.marketingEventId) return;
  // Effacé d'abord : un rejeu de la finalisation ne renverra pas l'événement.
  const cleared = await db.order.updateMany({
    where: { id: order.id, NOT: { marketingContext: { equals: Prisma.DbNull } } },
    data: { marketingContext: Prisma.DbNull },
  });
  if (cleared.count !== 1) return;
  await sendServerEvent(
    {
      name: "Purchase",
      eventId: order.marketingEventId,
      valueCents: order.totalCents,
      contents: order.items.map((i) => ({
        id: i.sku,
        name: `${i.productName} — ${i.variantLabel}`,
        quantity: i.quantity,
        priceCents: i.unitPriceCents,
      })),
    },
    context.data,
    { email: order.email, phone: order.phone, externalId: order.customerId },
  );
}
