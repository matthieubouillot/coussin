import "server-only";
import { env } from "@/server/env";

/**
 * URL publique d'une page admin. Les pages vivent sous /admin en interne mais ne sont servies
 * que sous /<ADMIN_PATH> : toute redirection ou lien doit passer par ici.
 */
export function adminHref(path = ""): string {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `/${env().ADMIN_PATH}${suffix}`;
}
