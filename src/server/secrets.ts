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

/** Clé AES-256 (32 octets) des secrets stockés en base. */
export function secretsEncryptionKey(): Buffer {
  const raw = env().SECRETS_ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) throw new Error("SECRETS_ENCRYPTION_KEY doit faire 32 octets (base64)");
    return key;
  }
  return Buffer.alloc(32, devFallback("SECRETS_ENCRYPTION_KEY"));
}
