import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/server/env";
import { ipHashSecret } from "@/server/secrets";

/**
 * Limitation de débit par action et par visiteur.
 *
 * En ligne : Upstash Redis (partagé entre toutes les fonctions Vercel).
 * En dev/test sans Upstash : compteur en mémoire, suffisant sur un seul processus.
 * L'identifiant est un hash HMAC de l'IP : l'adresse n'est jamais stockée en clair.
 */

type Window = `${number} ${"s" | "m" | "h"}`;
type Rule = { limit: number; window: Window };

export const RATE_LIMITS = {
  cartUpdate: { limit: 60, window: "1 m" },
  promoCode: { limit: 10, window: "10 m" },
  consent: { limit: 20, window: "1 m" },
  checkout: { limit: 10, window: "10 m" },
  orderTracking: { limit: 10, window: "10 m" },
  contact: { limit: 5, window: "10 m" },
  withdrawal: { limit: 5, window: "10 m" },
  // Par IP : contre l'attaque de nombreux comptes. Le verrouillage par compte (5 échecs) est dans loginAction.
  adminLogin: { limit: 10, window: "15 m" },
  adminTotp: { limit: 10, window: "15 m" },
} as const satisfies Record<string, Rule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const upstashLimiters = new Map<RateLimitName, Ratelimit>();

function upstashLimiter(name: RateLimitName): Ratelimit | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env();
  if (!url || !token) return null;
  let limiter = upstashLimiters.get(name);
  if (!limiter) {
    const rule = RATE_LIMITS[name];
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
      prefix: `rl:${name}`,
    });
    upstashLimiters.set(name, limiter);
  }
  return limiter;
}

// Repli mémoire (dev/test uniquement : en production, Upstash est obligatoire via env()).
const memoryHits = new Map<string, number[]>();

function windowMs(window: Window): number {
  const [amount, unit] = window.split(" ") as [string, "s" | "m" | "h"];
  return Number(amount) * { s: 1_000, m: 60_000, h: 3_600_000 }[unit];
}

export function memoryLimit(key: string, rule: Rule, now = Date.now()): boolean {
  const since = now - windowMs(rule.window);
  const hits = (memoryHits.get(key) ?? []).filter((t) => t > since);
  if (hits.length >= rule.limit) {
    memoryHits.set(key, hits);
    return false;
  }
  hits.push(now);
  memoryHits.set(key, hits);
  return true;
}

export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  // Sur Vercel, x-forwarded-for est réécrit par la plateforme : le premier élément est fiable.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHmac("sha256", ipHashSecret()).update(ip).digest("base64url").slice(0, 32);
}

/** true si l'action est autorisée, false si le visiteur a dépassé la limite. */
export async function checkRateLimit(name: RateLimitName): Promise<boolean> {
  const id = await clientFingerprint();
  const limiter = upstashLimiter(name);
  if (limiter) {
    const { success } = await limiter.limit(id);
    return success;
  }
  return memoryLimit(`${name}:${id}`, RATE_LIMITS[name]);
}
