import type { BrowserOptions, ErrorEvent } from "@sentry/nextjs";

/**
 * Options Sentry communes (navigateur, serveur, edge).
 * Objectif RGPD : aucune donnée personnelle ne doit partir chez Sentry.
 * On coupe la collecte à la source (dataCollection) puis on masque ce qui passerait quand même (beforeSend).
 */

import { scrubText } from "@/lib/logging/safe-error";

export { scrubText };

/** Message Prisma : seule la cause (dernière ligne) est conservée, sans les arguments de la requête. */
function scrubPrisma(text: string): string {
  if (!/invocation/.test(text)) return text;
  return (
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .at(-1) ?? ""
  );
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = scrubText(event.request.url);
  }
  if (event.message) event.message = scrubText(scrubPrisma(event.message));
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(scrubPrisma(exception.value));
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) breadcrumb.message = scrubText(breadcrumb.message);
    delete breadcrumb.data;
  }
  return event;
}

// Sentry v11 a remplacé `sendDefaultPii` par `dataCollection`, plus fin : tout est coupé sauf le strict utile.
export const sharedSentryOptions: Pick<BrowserOptions, "dataCollection" | "tracesSampleRate" | "beforeSend"> =
  {
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend: scrubEvent,
  };
