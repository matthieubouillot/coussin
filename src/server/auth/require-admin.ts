import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { adminHref } from "@/server/auth/admin-path";

export type AdminUser = { id: string; email: string; name: string; role: string };

const ADMIN_ROLES = new Set(["admin"]);

const currentSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/**
 * À appeler en tête de CHAQUE page et Server Action admin (le proxy ne protège rien).
 * Exige une session valide, un rôle admin et la 2FA activée ; sinon redirection vers la connexion
 * ou l'enrôlement 2FA.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const session = await currentSession();
  if (!session) redirect(adminHref("/login"));
  const user = session.user;
  if (!ADMIN_ROLES.has(user.role)) redirect(adminHref("/login"));
  if (!user.twoFactorEnabled) redirect(adminHref("/securite/activer-2fa"));
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Variante réservée à l'écran d'enrôlement 2FA : session exigée, 2FA pas encore active. */
export async function requireAdminPendingTwoFactor(): Promise<AdminUser & { twoFactorEnabled: boolean }> {
  const session = await currentSession();
  if (!session || !ADMIN_ROLES.has(session.user.role)) redirect(adminHref("/login"));
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
  };
}

export async function currentSessionId(): Promise<string | null> {
  return (await currentSession())?.session.id ?? null;
}

/** Pour les routes API admin : null au lieu d'une redirection (qui révélerait le chemin admin). */
export async function getAdminOrNull(): Promise<AdminUser | null> {
  const session = await currentSession();
  const user = session?.user;
  if (!user || !ADMIN_ROLES.has(user.role) || !user.twoFactorEnabled) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
