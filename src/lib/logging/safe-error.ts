/**
 * Message d'erreur sans donnée personnelle, pour les journaux et Sentry.
 *
 * Les erreurs Prisma recopient les arguments de la requête (email, adresse…) dans leur message :
 * on ne garde que leur code et la dernière ligne (la cause), puis on masque emails et téléphones.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g;

export function scrubText(text: string): string {
  return text.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[téléphone]");
}

export function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Erreur inconnue";
  const code = (error as { code?: unknown }).code;
  let message = error.message;
  // Message Prisma « Invalid `prisma.x.y()` invocation … » : le corps contient les données.
  if (/invocation/.test(message)) {
    const lines = message
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    message = lines.at(-1) ?? "";
  }
  const prefix = typeof code === "string" && code ? `[${code}] ` : "";
  return scrubText(`${prefix}${error.name}: ${message}`).slice(0, 500);
}
