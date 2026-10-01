import Stripe from "stripe";
import { vi } from "vitest";
import { db } from "@/server/db";

// Liste fixe (aucune donnée externe) : TRUNCATE ne déclenche pas les triggers ligne par ligne.
const TABLES = [
  "EmailLog",
  "Review",
  "ReviewInvite",
  "WithdrawalRequest",
  "Refund",
  "Invoice",
  "InvoiceSequence",
  "PurchaseRecord",
  "OrderItem",
  "SupplierOrder",
  "OrderStatusEvent",
  "OrderNote",
  "Order",
  "Customer",
  "PromoCode",
  "BundleOffer",
  "ShippingRate",
  "SupplierCostHistory",
  "SupplierOffer",
  "SalePriceHistory",
  "Variant",
  "ProductMedia",
  "Product",
  "ShopSettings",
  "ProcessedWebhookEvent",
  "ContactMessage",
  "ConsentRecord",
  "AuditLog",
];

export async function resetDatabase() {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export const WEBHOOK_SECRET = "whsec_integration_test_secret";
const signer = new Stripe("sk_test_integration_dummy");

/** Construit une requête webhook signée exactement comme Stripe le ferait. */
export function signedWebhookRequest(event: object, secret = WEBHOOK_SECRET): Request {
  const payload = JSON.stringify(event);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}

export const retrievePaymentIntent = vi.fn(async () => ({
  id: "pi_test",
  payment_method: { type: "card", card: { wallet: { type: "apple_pay" } } },
}));

/** Une commande en attente de paiement, telle que la crée le tunnel de commande. */
export async function createPendingOrder(overrides: { totalCents?: number; promoCodeId?: string } = {}) {
  const product = await db.product.create({
    data: {
      slug: `p-${Math.random().toString(36).slice(2)}`,
      name: "Coussin auto-chauffant",
      tagline: "t",
      contentBlocks: {},
      sizeGuide: {},
      packageContents: "1 coussin",
      active: true,
    },
  });
  const variant = await db.variant.create({
    data: {
      productId: product.id,
      sku: `SKU-${Math.random().toString(36).slice(2)}`,
      label: "M — 60 × 48 cm",
      widthCm: 60,
      lengthCm: 48,
      recommendedFor: "Chats",
      priceCents: 2990,
      position: 1,
    },
  });
  const number = `C-${Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "X")}`;
  return db.order.create({
    data: {
      number,
      email: "",
      subtotalCents: 2990,
      shippingCents: 490,
      totalCents: overrides.totalCents ?? 3480,
      taxMode: "FRANCHISE_293B",
      promoCodeId: overrides.promoCodeId,
      stripeCheckoutSessionId: `cs_test_${number}`,
      cgvVersion: "2026-10-01",
      items: {
        create: {
          variantId: variant.id,
          productName: "Coussin auto-chauffant",
          variantLabel: "M — 60 × 48 cm",
          sku: variant.sku,
          quantity: 1,
          unitPriceCents: 2990,
        },
      },
    },
  });
}

let eventCounter = 0;

export function completedEvent(
  order: { id: string; stripeCheckoutSessionId: string | null },
  amountTotal = 3480,
) {
  eventCounter += 1;
  return {
    id: `evt_test_${Date.now()}_${eventCounter}`,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: order.stripeCheckoutSessionId,
        object: "checkout.session",
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        payment_status: "paid",
        amount_total: amountTotal,
        currency: "eur",
        payment_intent: `pi_test_${eventCounter}_${order.id}`,
        customer_details: { email: "Client.Test@Example.fr", name: "Camille Martin", phone: "+33612345678" },
        collected_information: {
          shipping_details: {
            name: "Camille Martin",
            address: {
              line1: "12 rue des Lilas",
              line2: null,
              postal_code: "69001",
              city: "Lyon",
              country: "FR",
            },
          },
        },
      },
    },
  };
}
