/**
 * Masquage du back-office.
 *
 * Les pages admin vivent dans `src/app/admin`, mais ne sont jamais servies sous `/admin` :
 * elles ne sont joignables que via `/<ADMIN_PATH>` (segment secret en variable d'environnement).
 * C'est une barrière contre le scan automatisé, pas une protection : l'authentification
 * et la 2FA restent vérifiées côté serveur sur chaque page et chaque Server Action.
 */

export const INTERNAL_ADMIN_PREFIX = "/admin";

export type AdminRouting =
  { kind: "passthrough" } | { kind: "not-found" } | { kind: "rewrite"; internalPath: string };

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveAdminRouting(pathname: string, adminPath: string | undefined): AdminRouting {
  // Accès direct au chemin interne : on fait comme s'il n'existait pas.
  if (isUnder(pathname, INTERNAL_ADMIN_PREFIX)) return { kind: "not-found" };

  if (!adminPath) return { kind: "passthrough" };

  const publicPrefix = `/${adminPath}`;
  if (isUnder(pathname, publicPrefix)) {
    return { kind: "rewrite", internalPath: INTERNAL_ADMIN_PREFIX + pathname.slice(publicPrefix.length) };
  }
  return { kind: "passthrough" };
}
