import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry/options";

// Le DSN Sentry n'est pas un secret (il ne permet que d'envoyer des erreurs) : il peut être public.
// Pas de Session Replay : il enregistrerait la saisie des clients.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  ...sharedSentryOptions,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
