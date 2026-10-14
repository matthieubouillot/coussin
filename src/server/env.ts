import "server-only";
import { z } from "zod";

/**
 * Variables d'environnement serveur, validées par Zod au premier accès.
 *
 * Les services branchés dans les phases suivantes (Stripe, Resend, fournisseurs…) sont
 * optionnels en développement pour qu'on puisse lancer le socle sans tous les comptes,
 * mais deviennent obligatoires en production : un oubli fait échouer le démarrage
 * plutôt qu'une commande client.
 */

const isProduction = process.env.VERCEL_ENV === "production";

const required = z.string().min(1);
// En production, une variable de service manquante est une erreur ; ailleurs, elle est tolérée.
const service = isProduction ? required : required.optional();

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),

  DATABASE_URL: z.url(),
  DIRECT_URL: z.url().optional(),

  NEXT_PUBLIC_SITE_URL: z.url(),
  // Segment d'URL secret de l'admin : lettres, chiffres et tirets, assez long pour ne pas être deviné.
  ADMIN_PATH: z
    .string()
    .regex(/^[a-z0-9-]{12,64}$/, "ADMIN_PATH : 12 à 64 caractères a-z, 0-9 ou tiret")
    .refine((v) => v !== "admin", "ADMIN_PATH ne doit pas être « admin »"),

  AUTH_SECRET: service,
  AUTH_URL: z.url().optional(),
  // Clé HMAC pour hacher les IP (journal d'audit, rate limiting) sans les stocker en clair.
  IP_HASH_SECRET: service,
  // Clé de signature du cookie panier.
  CART_COOKIE_SECRET: service,
  // Clé AES-256 (32 octets en base64) pour chiffrer en base les jetons d'API fournisseur.
  SECRETS_ENCRYPTION_KEY: service,

  STRIPE_SECRET_KEY: service,
  STRIPE_WEBHOOK_SECRET: service,
  // Verrou du mode live : tant qu'il ne vaut pas "true", une clé sk_live_ est refusée (phase 8).
  STRIPE_LIVE_ENABLED: z.enum(["true", "false"]).optional(),
  // Tests de charge / E2E uniquement : faux serveur Stripe local. Interdit en production.
  STRIPE_API_BASE: isProduction
    ? z.undefined({ error: "STRIPE_API_BASE interdit en production" })
    : z.url().optional(),

  RESEND_API_KEY: service,
  EMAIL_FROM: service,
  ADMIN_ALERT_EMAIL: isProduction ? z.email() : z.email().optional(),

  ALIEXPRESS_APP_KEY: z.string().optional(),
  ALIEXPRESS_APP_SECRET: z.string().optional(),
  ALIEXPRESS_ACCESS_TOKEN: z.string().optional(),
  // Jeton de renouvellement initial ; ensuite les jetons sont renouvelés et stockés chiffrés en base.
  ALIEXPRESS_REFRESH_TOKEN: z.string().optional(),
  CJ_API_KEY: z.string().optional(),

  UPSTASH_REDIS_REST_URL: isProduction ? z.url() : z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: service,
  QSTASH_TOKEN: service,
  QSTASH_CURRENT_SIGNING_KEY: service,
  QSTASH_NEXT_SIGNING_KEY: service,

  TURNSTILE_SITE_KEY: service,
  TURNSTILE_SECRET_KEY: service,

  BLOB_READ_WRITE_TOKEN: service,
  // Hôte public de l'espace Blob (ex. abcd1234.public.blob.vercel-storage.com) : seul hôte d'images autorisé.
  BLOB_PUBLIC_HOSTNAME: isProduction
    ? z.string().regex(/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/)
    : z
        .string()
        .regex(/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/)
        .optional(),

  TIKTOK_PIXEL_ID: z
    .string()
    .regex(/^[A-Z0-9]{10,30}$/, "TIKTOK_PIXEL_ID : identifiant du pixel (lettres majuscules et chiffres)")
    .optional(),
  TIKTOK_EVENTS_API_TOKEN: z.string().optional(),
  // Meta (désactivé par défaut : activable dans les réglages une fois ces clés renseignées).
  META_PIXEL_ID: z
    .string()
    .regex(/^\d{5,20}$/)
    .optional(),
  META_CAPI_TOKEN: z.string().optional(),

  SENTRY_DSN: z.url().optional(),
  CRON_SECRET: isProduction ? z.string().min(32) : z.string().min(32).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // On liste les noms des variables en cause, jamais leurs valeurs.
    const issues = result.error.issues
      .map((issue) => `- ${issue.path.join(".")} : ${issue.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement invalides :\n${issues}`);
  }
  return result.data;
}

export function env(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
