# Sécurité

> Document vivant : chaque phase ajoute ce qu'elle met en place. La revue complète a lieu en phase 7.

## Mesures en place (phase 1 — socle)

| Mesure                                                                                                                                                                               | Où                                               | Vérifié par                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| CSP stricte avec nonce par requête, `strict-dynamic`, sans `unsafe-inline` ni `unsafe-eval` en production                                                                            | `src/lib/security/csp.ts`, `src/proxy.ts`        | `tests/unit/csp.test.ts`, `tests/e2e/socle.spec.ts` (nonce unique, aucune violation console) |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` (anti-clickjacking)                                                                                                               | CSP, `next.config.ts`                            | tests unitaires et E2E                                                                       |
| HSTS 2 ans + preload, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` restrictive, COOP                                                                   | `next.config.ts`                                 | E2E                                                                                          |
| En-tête `X-Powered-By` supprimé                                                                                                                                                      | `next.config.ts`                                 | E2E                                                                                          |
| Admin inaccessible sous `/admin` (404), servi uniquement sous un segment secret, `X-Robots-Tag: noindex`, `Cache-Control: no-store`                                                  | `src/lib/security/admin-path.ts`, `src/proxy.ts` | `tests/unit/admin-path.test.ts`, E2E                                                         |
| Variables d'environnement validées par Zod ; en production, un service non configuré bloque le démarrage ; les messages d'erreur ne contiennent jamais les valeurs                   | `src/server/env.ts`                              | `tests/unit/env.test.ts`                                                                     |
| Code serveur marqué `server-only` (import interdit côté client)                                                                                                                      | `src/server/**`                                  | build                                                                                        |
| Aucun secret dans Git : `.env*` ignorés sauf `.env.example` sans valeur                                                                                                              | `.gitignore`                                     | revue                                                                                        |
| Sentry sans données personnelles : collecte coupée à la source + masquage emails/téléphones                                                                                          | `src/lib/sentry/options.ts`                      | `tests/unit/sentry-scrub.test.ts`                                                            |
| Pas de Session Replay Sentry (enregistrerait les saisies clients)                                                                                                                    | `src/instrumentation-client.ts`                  | revue                                                                                        |
| Dépendances : versions exactes, lockfile, `pnpm audit` en CI, Dependabot hebdomadaire, scripts d'installation bloqués sauf liste blanche, correctifs transitifs forcés (`overrides`) | `package.json`, `pnpm-workspace.yaml`, CI        | CI                                                                                           |
| `no-console` (sauf warn/error) pour éviter les fuites dans les logs                                                                                                                  | `eslint.config.mjs`                              | lint                                                                                         |

## OWASP Top 10 (2021) — état

| Risque                            | Traitement prévu                                                                                     | Phase         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------- |
| A01 Contrôle d'accès              | `requireAdmin()` dans chaque Server Action / route admin, en plus du masquage                        | 4             |
| A02 Défaillances cryptographiques | HTTPS/HSTS ✅ ; jetons stockés hachés ; cookies `HttpOnly Secure SameSite`                           | 1 ✅ / 3-4    |
| A03 Injection                     | Prisma (requêtes paramétrées), Zod partout, CSP ✅                                                   | 1 ✅ / toutes |
| A04 Conception non sécurisée      | Prix recalculés serveur, machine à états, idempotence webhooks                                       | 3             |
| A05 Mauvaise configuration        | En-têtes ✅, env validée ✅, `poweredByHeader` off ✅                                                | 1 ✅          |
| A06 Composants vulnérables        | audit CI ✅, Dependabot ✅                                                                           | 1 ✅          |
| A07 Authentification              | Better Auth + TOTP obligatoire, verrouillage, rate limiting                                          | 4             |
| A08 Intégrité logiciel/données    | Signatures Stripe/QStash/CJ vérifiées, lockfile ✅                                                   | 1 ✅ / 3-5    |
| A09 Journalisation                | Journal d'audit, Sentry sans PII ✅                                                                  | 1 ✅ / 4      |
| A10 SSRF                          | Appels sortants uniquement vers des hôtes fixes (fournisseurs), aucune URL fournie par l'utilisateur | 5             |
