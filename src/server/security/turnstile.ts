import "server-only";
import { z } from "zod";
import { env } from "@/server/env";

// Clés de test officielles de Cloudflare (toujours valides), utilisées uniquement hors production.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export function turnstileSiteKey(): string {
  return env().TURNSTILE_SITE_KEY ?? TEST_SITE_KEY;
}

const verifyResponseSchema = z.object({ success: z.boolean() });

/** Vérifie côté serveur le jeton produit par le widget. Toute erreur vaut refus. */
export async function verifyTurnstile(token: unknown): Promise<boolean> {
  const parsed = z.string().min(1).max(2048).safeParse(token);
  if (!parsed.success) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env().TURNSTILE_SECRET_KEY ?? TEST_SECRET_KEY, response: parsed.data }),
      signal: AbortSignal.timeout(5000),
    });
    const result = verifyResponseSchema.safeParse(await response.json());
    return result.success && result.data.success;
  } catch {
    return false;
  }
}
