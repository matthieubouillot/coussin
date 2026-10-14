import type Stripe from "stripe";
import { env } from "@/server/env";
import { handleStripeEvent } from "@/server/stripe/handle-event";
import { stripe } from "@/server/stripe/stripe";
import { safeErrorMessage } from "@/lib/logging/safe-error";

// Webhook Stripe : seule source de vérité pour valider un paiement.
// Signature vérifiée sur le corps BRUT (le moindre reformatage la rendrait invalide).
export async function POST(request: Request): Promise<Response> {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Signature manquante", { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    // 500 : Stripe réessaiera (jusqu'à 3 jours) ; le traitement est idempotent.
    console.error("Webhook Stripe en échec", event.id, event.type, safeErrorMessage(error));
    return new Response("Erreur de traitement", { status: 500 });
  }
  return Response.json({ received: true });
}
