import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  ...sharedSentryOptions,
});
