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

export const createStripeRefund = vi.fn(async (params: { amount: number }) => ({
  id: `re_test_${Math.random().toString(36).slice(2)}`,
  status: "succeeded",
  amount: params.amount,
}));

/** Client Stripe simulé : signature des webhooks réelle, appels réseau sortants simulés. */
export async function fakeStripeModule() {
  const { default: Stripe } = await import("stripe");
  const real = new Stripe("sk_test_integration_dummy");
  const client = {
    webhooks: real.webhooks,
    paymentIntents: { retrieve: retrievePaymentIntent },
    refunds: { create: createStripeRefund },
  };
  return { stripe: () => client, isStripeConfigured: () => true, STRIPE_API_VERSION: "2026-09-30.endive" };
}

/** Commande payée de bout en bout via le webhook (facture émise). */
export async function createPaidOrder(post: (req: Request) => Promise<Response>) {
  const order = await createPendingOrder();
  const response = await post(signedWebhookRequest(completedEvent(order)));
  if (response.status !== 200) throw new Error(`Webhook en échec : ${response.status}`);
  return order;
}

/** Fournisseurs simulés, pilotés test par test (seul l'appel réseau est remplacé). */
export function makeFakeAdapter(kind: "ALIEXPRESS" | "CJ" | "MANUAL") {
  return {
    kind,
    getProduct: vi.fn(async () => ({ title: "Coussin", variants: [] })),
    getStockAndPrice: vi.fn(async () => ({
      stock: 50 as number | null,
      unitCost: 579 as number | null,
      currency: "EUR" as "EUR" | "USD",
    })),
    placeOrder: vi.fn(async (req: { reference: string }) => ({
      externalOrderId: `${kind}-${req.reference.slice(-6)}`,
      payment: "PAID" as "PAID" | "AWAITING_PAYMENT" | "MANUAL",
      totalCostCents: 779 as number | null,
    })),
    getOrderStatus: vi.fn(async () => "PROCESSING" as string),
    getTracking: vi.fn(
      async () =>
        null as null | {
          trackingNumber: string;
          carrier: string | null;
          trackingUrl: string | null;
          delivered: boolean;
        },
    ),
    cancelOrder: vi.fn(async () => undefined),
  };
}

export const fakeAdapters = {
  ALIEXPRESS: makeFakeAdapter("ALIEXPRESS"),
  CJ: makeFakeAdapter("CJ"),
  MANUAL: makeFakeAdapter("MANUAL"),
};

export function resetFakeAdapters() {
  for (const kind of ["ALIEXPRESS", "CJ", "MANUAL"] as const)
    Object.assign(fakeAdapters[kind], makeFakeAdapter(kind));
}

/** Ajoute des offres fournisseur à la variante de la commande (priorité dans l'ordre donné). */
export async function addOffers(
  orderId: string,
  offers: { adapter: "ALIEXPRESS" | "CJ" | "MANUAL"; deliveryDaysMax?: number }[],
) {
  const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
  await db.order.update({
    where: { id: orderId },
    data: { estimatedDeliveryMax: new Date(Date.now() + 12 * 86_400_000) },
  });
  for (const [index, offer] of offers.entries()) {
    await db.supplierOffer.create({
      data: {
        variantId: item.variantId,
        adapter: offer.adapter,
        supplierName: `Fournisseur ${index + 1}`,
        externalProductId: "1005010155230759",
        externalSkuId: "14:193",
        priority: index + 1,
        purchaseCostCents: 579,
        shippingCostCents: 200,
        deliveryDaysMin: 5,
        deliveryDaysMax: offer.deliveryDaysMax ?? 10,
      },
    });
  }
}

/** Rend immédiatement dues les tentatives programmées (simule le passage du temps). */
export async function makeRetriesDue(orderId: string) {
  await db.supplierOrder.updateMany({
    where: { orderId, status: "QUEUED" },
    data: { nextAttemptAt: new Date(Date.now() - 1000) },
  });
}
