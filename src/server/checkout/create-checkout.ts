import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type Stripe from "stripe";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getCartView, type CartView } from "@/server/cart/cart";
import { generateOrderNumber } from "@/server/orders/order-number";
import { isPlaceholder } from "@/server/settings/legal-identity";
import { getShopConfig } from "@/server/settings/settings";
import { stripe } from "@/server/stripe/stripe";
import type { Attribution } from "@/lib/marketing/events";
import type { MarketingContext } from "@/server/marketing/context";
import { sendServerEvent } from "@/server/marketing/destinations";

export type CheckoutResult = { ok: true; url: string } | { ok: false; message: string };

const SESSION_LIFETIME_SECONDS = 60 * 60;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Crée la commande (PENDING_PAYMENT) puis la session Stripe Checkout.
 *
 * Les montants envoyés à Stripe sont ceux recalculés ici depuis la base ; la commande ne passera
 * PAID que par le webhook signé, qui revérifie que Stripe a encaissé exactement ce total.
 */
export type CheckoutMarketing = {
  /** Identifiant de l'événement InitiateCheckout déjà envoyé par le pixel (déduplication). */
  initiateCheckoutEventId: string | null;
  attribution: Attribution;
  /** Contexte publicitaire, présent uniquement si le client a consenti. */
  context: MarketingContext | null;
};

export async function createCheckout(options: {
  siteUrl: string;
  marketing: CheckoutMarketing;
}): Promise<CheckoutResult> {
  const [cart, config, shipping] = await Promise.all([
    getCartView(),
    getShopConfig(),
    db.shippingRate.findFirst({ where: { active: true, country: "FR" }, orderBy: { priceCents: "asc" } }),
  ]);

  if (cart.lines.length === 0) return { ok: false, message: "Votre panier est vide." };
  if (!shipping) return { ok: false, message: "La livraison n'est pas encore configurée." };

  // Une facture ne peut pas être émise sans l'identité réelle du vendeur : on bloque la vente en ligne.
  if (
    env().VERCEL_ENV === "production" &&
    Object.values(config.legal)
      .flat()
      .some((v) => typeof v === "string" && isPlaceholder(v))
  ) {
    console.error("Paiement bloqué : identité légale incomplète dans les réglages");
    return { ok: false, message: "Le paiement est momentanément indisponible." };
  }

  const order = await createPendingOrder(cart, config.taxMode, config.cgvVersion, options.marketing);
  if (options.marketing.context) {
    const context = options.marketing.context;
    const event = {
      name: "InitiateCheckout" as const,
      eventId: options.marketing.initiateCheckoutEventId ?? `ic${order.marketingEventId}`,
      valueCents: order.totalCents,
      contents: cart.lines.map((l) => ({
        id: l.sku,
        name: `${l.productName} — ${l.label}`,
        quantity: l.quantity,
        priceCents: l.unitPriceCents,
      })),
      pageUrl: `${options.siteUrl}/panier`,
    };
    // Après la réponse : l'envoi à la régie ne retarde jamais la redirection vers le paiement.
    after(() => sendServerEvent(event, context));
  }
  const session = await createStripeSession(order, cart, options.siteUrl);

  await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
  if (!session.url) return { ok: false, message: "Le paiement est momentanément indisponible." };
  return { ok: true, url: session.url };
}

async function createPendingOrder(
  cart: CartView,
  taxMode: "FRANCHISE_293B" | "STANDARD",
  cgvVersion: string,
  marketing: CheckoutMarketing,
) {
  const { totals } = cart;
  const promo = totals.promo
    ? await db.promoCode.findUnique({ where: { code: totals.promo.code }, select: { id: true } })
    : null;

  // Délai annoncé au client au moment de l'achat : le plus long des articles commandés.
  const maxDays = Math.max(
    ...cart.lines.map((l) => (l.availability.available ? l.availability.deliveryDaysMax : 0)),
  );
  const estimatedDeliveryMax = new Date(Date.now() + maxDays * 86_400_000);

  const variants = await db.variant.findMany({
    where: { id: { in: cart.lines.map((l) => l.variantId) } },
    select: { id: true, sku: true },
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.order.create({
        data: {
          number: generateOrderNumber(),
          status: "PENDING_PAYMENT",
          email: "",
          subtotalCents: totals.subtotalCents,
          bundleDiscountCents: totals.bundle?.discountCents ?? 0,
          promoDiscountCents: totals.promo?.discountCents ?? 0,
          shippingCents: totals.shippingCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          taxMode,
          promoCodeId: promo?.id,
          estimatedDeliveryMax,
          cgvAcceptedAt: new Date(),
          cgvVersion,
          marketingEventId: randomUUID().replace(/-/g, ""),
          // Provenance (UTM) : conservée pour savoir quelle publicité a vendu, consentement ou non.
          utmSource: marketing.attribution.utm_source,
          utmMedium: marketing.attribution.utm_medium,
          utmCampaign: marketing.attribution.utm_campaign,
          utmContent: marketing.attribution.utm_content,
          utmTerm: marketing.attribution.utm_term,
          // Identifiants publicitaires : seulement avec consentement.
          ttclid: marketing.context ? marketing.attribution.ttclid : undefined,
          adsConsent: marketing.context !== null,
          marketingContext: marketing.context ?? undefined,
          items: {
            create: cart.lines.map((l) => ({
              variantId: l.variantId,
              productName: l.productName,
              variantLabel: l.label,
              sku: variants.find((v) => v.id === l.variantId)?.sku ?? "",
              quantity: l.quantity,
              unitPriceCents: l.unitPriceCents,
            })),
          },
          statusEvents: {
            create: { toStatus: "PENDING_PAYMENT", actorType: "CUSTOMER", reason: "Validation du panier" },
          },
        },
      });
    } catch (error) {
      // Collision (très improbable) sur le numéro de commande aléatoire : on en tire un autre.
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Impossible de générer un numéro de commande unique");
}

async function createStripeSession(
  order: {
    id: string;
    number: string;
    totalCents: number;
    shippingCents: number;
    bundleDiscountCents: number;
    promoDiscountCents: number;
  },
  cart: CartView,
  siteUrl: string,
): Promise<Stripe.Checkout.Session> {
  const client = stripe();
  const discountCents = order.bundleDiscountCents + order.promoDiscountCents;

  // Stripe n'accepte pas de ligne négative : les remises passent par un coupon à usage unique.
  const coupon =
    discountCents > 0
      ? await client.coupons.create(
          {
            amount_off: discountCents,
            currency: "eur",
            duration: "once",
            max_redemptions: 1,
            name: "Remises",
          },
          { idempotencyKey: `coupon-${order.id}` },
        )
      : null;

  const maxDays = Math.max(
    ...cart.lines.map((l) => (l.availability.available ? l.availability.deliveryDaysMax : 1)),
  );
  const minDays = Math.min(
    ...cart.lines.map((l) => (l.availability.available ? l.availability.deliveryDaysMin : 1)),
  );

  return client.checkout.sessions.create(
    {
      mode: "payment",
      locale: "fr",
      currency: "eur",
      client_reference_id: order.id,
      metadata: { orderId: order.id, orderNumber: order.number },
      payment_intent_data: { metadata: { orderId: order.id }, description: `Commande ${order.number}` },
      // Carte (avec Apple Pay et Google Pay) uniquement : paiement immédiat, pas de moyen différé.
      allowed_payment_method_types: ["card"],
      line_items: cart.lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "eur",
          unit_amount: l.unitPriceCents,
          product_data: { name: `${l.productName} — taille ${l.label}` },
        },
      })),
      discounts: coupon ? [{ coupon: coupon.id }] : undefined,
      shipping_address_collection: { allowed_countries: ["FR"] },
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Livraison standard suivie",
            fixed_amount: { amount: order.shippingCents, currency: "eur" },
            delivery_estimate: {
              minimum: { unit: "day", value: minDays },
              maximum: { unit: "day", value: maxDays },
            },
          },
        },
      ],
      expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
      success_url: `${siteUrl}/commande/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/panier`,
    },
    { idempotencyKey: `checkout-${order.id}` },
  );
}
