import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { db } from "@/server/db";
import { env } from "@/server/env";

/**
 * Authentification du back-office (Better Auth).
 *
 * - Aucune route HTTP /api/auth n'est exposée : tout passe par des Server Actions qui appellent
 *   `auth.api` côté serveur. Moins de surface d'attaque, et l'admin ne se révèle pas.
 * - Pas d'inscription publique : les comptes sont créés par `pnpm admin:create`.
 * - 2FA TOTP obligatoire : tant qu'elle n'est pas activée, `requireAdmin()` refuse tout accès.
 */

function authSecret(): string {
  const secret = env().AUTH_SECRET;
  if (secret) return secret;
  if (env().VERCEL_ENV === "production") throw new Error("AUTH_SECRET manquant en production");
  return "dev-only-AUTH_SECRET-not-a-secret-0123456789";
}

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const auth = betterAuth({
  appName: "Administration boutique",
  baseURL: env().AUTH_URL ?? env().NEXT_PUBLIC_SITE_URL,
  secret: authSecret(),
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  session: {
    // Session courte : 8 h maximum, prolongée par tranches d'1 h tant que l'admin est actif.
    expiresIn: SESSION_MAX_AGE_SECONDS,
    updateAge: 60 * 60,
  },
  user: {
    additionalFields: {
      // Un seul rôle aujourd'hui ; le champ prépare l'arrivée d'autres profils (ex. support).
      role: { type: "string", required: true, defaultValue: "admin", input: false },
    },
  },
  advanced: {
    cookiePrefix: "adm",
    useSecureCookies: env().NODE_ENV === "production",
    defaultCookieAttributes: { httpOnly: true, sameSite: "strict" },
  },
  plugins: [
    twoFactor({
      issuer: "Boutique — admin",
      // Le code de l'appli doit être vérifié une première fois avant que la 2FA soit active.
      skipVerificationOnEnable: false,
    }),
    // Doit rester le dernier plugin : pose les cookies depuis les Server Actions.
    nextCookies(),
  ],
});

export type AdminSession = typeof auth.$Infer.Session;
