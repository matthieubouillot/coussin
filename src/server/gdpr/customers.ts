import "server-only";
import { db } from "@/server/db";

/**
 * Droits RGPD des clients.
 * - Export (droit d'accès / portabilité) : toutes les données personnelles détenues, en JSON.
 * - Effacement : anonymisation. Les commandes et factures restent (obligation comptable de 10 ans),
 *   mais ne permettent plus d'identifier la personne hors des pièces comptables elles-mêmes.
 */

export async function exportCustomerData(customerId: string) {
  const customer = await db.customer.findUniqueOrThrow({
    where: { id: customerId },
    include: {
      orders: {
        include: {
          items: { select: { productName: true, variantLabel: true, quantity: true, unitPriceCents: true } },
          invoices: { select: { number: true, type: true, issuedAt: true, totalCents: true } },
          withdrawals: { select: { createdAt: true, message: true, status: true } },
        },
      },
    },
  });
  const [messages, reviews] = await Promise.all([
    db.contactMessage.findMany({
      where: { email: customer.email },
      select: { createdAt: true, name: true, body: true, orderNumber: true },
    }),
    db.review.findMany({
      where: { orderItem: { order: { customerId } } },
      select: { submittedAt: true, displayName: true, rating: true, body: true, status: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    customer: {
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      createdAt: customer.createdAt,
    },
    orders: customer.orders.map((o) => ({
      number: o.number,
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      email: o.email,
      phone: o.phone,
      shippingAddress: [
        o.shippingName,
        o.shippingLine1,
        o.shippingLine2,
        o.shippingPostalCode,
        o.shippingCity,
        o.shippingCountry,
      ],
      totalCents: o.totalCents,
      items: o.items,
      invoices: o.invoices,
      withdrawals: o.withdrawals,
      marketing: { utmSource: o.utmSource, utmMedium: o.utmMedium, utmCampaign: o.utmCampaign },
    })),
    contactMessages: messages,
    reviews,
  };
}

export async function anonymizeCustomer(customerId: string): Promise<void> {
  const placeholderEmail = `anonymise-${customerId}@invalid.invalid`;
  await db.$transaction(async (tx) => {
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    if (customer.anonymizedAt) return;

    await tx.contactMessage.deleteMany({ where: { email: customer.email } });
    await tx.order.updateMany({
      where: { customerId },
      data: {
        email: placeholderEmail,
        phone: null,
        shippingName: "Client anonymisé",
        shippingLine1: null,
        shippingLine2: null,
        shippingPostalCode: null,
        shippingCity: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        ttclid: null,
      },
    });
    await tx.review.updateMany({
      where: { orderItem: { order: { customerId } } },
      data: { displayName: "Client anonyme" },
    });
    await tx.reviewInvite.deleteMany({ where: { order: { customerId } } });
    await tx.customer.update({
      where: { id: customerId },
      data: {
        email: placeholderEmail,
        firstName: null,
        lastName: null,
        phone: null,
        anonymizedAt: new Date(),
      },
    });
  });
}
