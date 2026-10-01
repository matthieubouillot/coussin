import type { NextConfig } from "next";
// Sentry v11 : la configuration de build est exposée sous un sous-chemin dédié.
import { withSentryConfig } from "@sentry/nextjs/config";

// En-têtes statiques appliqués à toutes les réponses (pages, API, assets).
// La CSP, elle, dépend d'un nonce par requête : elle est posée par src/proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Apple Pay / Google Pay sont gérés sur la page Stripe, pas chez nous : tout est coupé.
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Les événements navigateur passent par notre domaine : CSP plus stricte et pas bloqués par les adblockers.
  tunnelRoute: "/monitoring",
  // Les source maps sont envoyées à Sentry puis retirées du déploiement public.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
