import type { BrowserOptions, ErrorEvent } from "@sentry/nextjs";

/**
 * Options Sentry communes (navigateur, serveur, edge).
 * Objectif RGPD : aucune donnée personnelle ne doit partir chez Sentry.
 * On coupe la collecte à la source (dataCollection) puis on masque ce qui passerait quand même (beforeSend).
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Numéros de téléphone français (+33 / 0X) avec séparateurs éventuels.
const PHONE_RE = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g;

export function scrubText(text: string): string {
  return text.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[téléphone]");
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = scrubText(event.request.url);
  }
  if (event.message) event.message = scrubText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
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
