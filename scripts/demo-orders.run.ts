/**
 * Commandes de DÉMONSTRATION pour visualiser l'admin en développement.
 *   pnpm demo:orders   (exécuté avec Vitest pour la résolution des modules ESM)
 * Passe par le vrai code (webhook de paiement, facture, envoi fournisseur, suivi). Les fournisseurs
 * n'étant pas configurés en dev, les commandes passent « à traiter manuellement », puis certaines
 * sont avancées comme le ferait l'admin. Refuse de tourner en production.
 */
import { test } from "vitest";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { db } from "@/server/db";
import { fulfillOrder } from "@/server/fulfillment/dispatch";
import {
  recordManualDelivery,
  recordManualPlacement,
  recordManualTracking,
} from "@/server/fulfillment/admin-operations";
import { handleStripeEvent } from "@/server/stripe/handle-event";

if (process.env.VERCEL_ENV === "production" || /neon\.tech/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("demo-orders : refusé sur une base en ligne (développement local uniquement).");
}

const CUSTOMERS = [
  {
    name: "Camille Martin",
    email: "camille.demo@example.test",
    line1: "12 rue des Lilas",
    zip: "69001",
    city: "Lyon",
  },
  {
    name: "Hélène Lefèvre",
    email: "helene.demo@example.test",
    line1: "3 place de l'Église",
    zip: "35000",
    city: "Rennes",
  },
  {
    name: "Lucas Bernard",
    email: "lucas.demo@example.test",
    line1: "8 avenue Jean Jaurès",
    zip: "33000",
    city: "Bordeaux",
  },
  {
    name: "Inès Dubois",
    email: "ines.demo@example.test",
    line1: "21 boulevard Victor Hugo",
    zip: "06000",
    city: "Nice",
  },
];

async function paidOrder(customer: (typeof CUSTOMERS)[number], lines: { sku: string; quantity: number }[]) {
  const variants = await db.variant.findMany({
    where: { sku: { in: lines.map((l) => l.sku) } },
    include: { product: true },
  });
  const items = lines.map((l) => {
    const v = variants.find((x) => x.sku === l.sku)!;
    return {
      variantId: v.id,
      productName: v.product.name,
      variantLabel: v.label,
      sku: v.sku,
      quantity: l.quantity,
      unitPriceCents: v.priceCents,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const shipping = subtotal >= 4900 ? 0 : 490;
  const number = `C-DEMO${Math.floor(Math.random() * 9000 + 1000)}`;
  const order = await db.order.create({
    data: {
      number,
      email: "",
      subtotalCents: subtotal,
      shippingCents: shipping,
      totalCents: subtotal + shipping,
      taxMode: "FRANCHISE_293B",
      paymentMethodType: "card",
      stripeCheckoutSessionId: `cs_test_demo_${randomUUID().replace(/-/g, "")}`,
      cgvAcceptedAt: new Date(),
      cgvVersion: "2026-10-01",
      estimatedDeliveryMax: new Date(Date.now() + 12 * 86_400_000),
      utmSource: "tiktok",
      utmCampaign: "noel-demo",
      items: { create: items },
      statusEvents: {
        create: { toStatus: "PENDING_PAYMENT", actorType: "CUSTOMER", reason: "Validation du panier" },
      },
    },
  });
  // Même chemin qu'un vrai paiement : événement Stripe « checkout.session.completed ».
  const event = {
    id: `evt_demo_${randomUUID()}`,
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: order.stripeCheckoutSessionId,
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        payment_status: "paid",
        amount_total: order.totalCents,
        currency: "eur",
        payment_intent: `pi_demo_${randomUUID().slice(0, 8)}`,
        customer_details: { email: customer.email, name: customer.name, phone: "+33612345678" },
        collected_information: {
          shipping_details: {
            name: customer.name,
            address: {
              line1: customer.line1,
              line2: null,
              postal_code: customer.zip,
              city: customer.city,
              country: "FR",
            },
          },
        },
      },
    },
  } as unknown as Stripe.Event;
  await handleStripeEvent(event);
  await fulfillOrder(order.id);
  return db.order.findUniqueOrThrow({ where: { id: order.id }, include: { supplierOrders: true } });
}

async function main() {
  const admin = await db.user.findFirst({ select: { id: true } });
  const adminId = admin?.id ?? "demo";

  // 1. Payée, à passer manuellement chez le fournisseur (API non configurée en dev).
  await paidOrder(CUSTOMERS[0]!, [{ sku: "COUSSIN-M", quantity: 1 }]);

  // 2. Commandée chez le fournisseur.
  const placed = await paidOrder(CUSTOMERS[1]!, [{ sku: "COUSSIN-L", quantity: 1 }]);
  await recordManualPlacement(
    placed.supplierOrders[0]!.id,
    { externalOrderId: "8160012345678901", costCents: 1149, paid: true },
    adminId,
  );

  // 3. Deux colis (M + L), expédiés.
  const shipped = await paidOrder(CUSTOMERS[2]!, [
    { sku: "COUSSIN-M", quantity: 1 },
    { sku: "COUSSIN-L", quantity: 1 },
  ]);
  for (const [i, so] of shipped.supplierOrders.entries()) {
    await recordManualPlacement(
      so.id,
      { externalOrderId: `81600999${i}`, costCents: i === 0 ? 779 : 1149, paid: true },
      adminId,
    );
    await recordManualTracking(
      so.id,
      { trackingNumber: `6A1234567890${i}`, carrier: "Colissimo", trackingUrl: null },
      adminId,
    );
  }

  // 4. Livrée.
  const delivered = await paidOrder(CUSTOMERS[3]!, [{ sku: "COUSSIN-M", quantity: 2 }]);
  const so = delivered.supplierOrders[0]!;
  await recordManualPlacement(so.id, { externalOrderId: "8160055555", costCents: 1558, paid: true }, adminId);
  await recordManualTracking(
    so.id,
    { trackingNumber: "LP00012345FR", carrier: "Colissimo", trackingUrl: null },
    adminId,
  );
  await recordManualDelivery(so.id, adminId);

  console.warn("4 commandes de démonstration créées (emails et factures dans .data/).");
}

test("commandes de démonstration", async () => {
  await main();
});
