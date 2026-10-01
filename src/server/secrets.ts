import "server-only";
import { env } from "@/server/env";

/**
 * Accès aux secrets applicatifs.
 * En production, env() a déjà garanti leur présence. En dev et en test, une valeur locale fixe
 * permet de lancer le projet sans configuration ; elle ne protège rien et ne sert jamais en ligne.
 */
function devFallback(name: string): string {
  if (env().VERCEL_ENV === "production") {
    throw new Error(`${name} manquant en production`);
  }
  return `dev-only-${name}-not-a-secret`;
}

export function cartCookieSecret(): string {
  return env().CART_COOKIE_SECRET ?? devFallback("CART_COOKIE_SECRET");
}

export function ipHashSecret(): string {
  return env().IP_HASH_SECRET ?? devFallback("IP_HASH_SECRET");
}
