import "server-only";
import Stripe from "stripe";
import { env } from "@/server/env";

/**
 * Client Stripe unique. La version d'API est épinglée explicitement : une mise à jour du SDK
 * ne doit jamais changer silencieusement le format des objets reçus (webhooks compris).
 * Le compte webhook dans le dashboard Stripe doit être réglé sur la même version.
 */
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;

let client: Stripe | undefined;

export function stripe(): Stripe {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant : paiement indisponible");
  // Garde-fou : tant que la phase 8 n'est pas validée, seules les clés de test sont acceptées.
  if (key.startsWith("sk_live_") && env().STRIPE_LIVE_ENABLED !== "true") {
    throw new Error(
      "Clé Stripe live refusée : le mode live doit être activé explicitement (STRIPE_LIVE_ENABLED)",
    );
  }
  client ??= new Stripe(key, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(env().STRIPE_SECRET_KEY);
}
