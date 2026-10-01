# Boutique coussin auto-chauffant

Boutique e-commerce « one-product » (dropshipping) : Next.js 16, Prisma 7 / PostgreSQL, Stripe Checkout, fulfillment automatique fournisseur.

- Cahier des charges : [`PROMPT_BOUTIQUE.md`](PROMPT_BOUTIQUE.md)
- Cadrage et décisions : [`docs/PHASE0_CADRAGE.md`](docs/PHASE0_CADRAGE.md)
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Sécurité : [`docs/SECURITY.md`](docs/SECURITY.md)
- Ce qui reste à faire hors code : [`TODO_MATTHIEU.md`](TODO_MATTHIEU.md)

## Prérequis

- Node.js ≥ 22 et pnpm 11 (`corepack enable`)
- PostgreSQL local (≥ 14) pour le développement — Neon (Francfort) en ligne

## Installation

```bash
pnpm install                      # génère aussi le client Prisma
cp .env.example .env              # puis remplir au minimum DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SITE_URL, ADMIN_PATH
createdb coussin_dev
pnpm db:migrate                   # applique les migrations
```

Exemple de `.env` local minimal :

```bash
DATABASE_URL="postgresql://<utilisateur>@localhost:5432/coussin_dev"
DIRECT_URL="postgresql://<utilisateur>@localhost:5432/coussin_dev"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ADMIN_PATH="gestion-dev-local"
```

## Lancement

```bash
pnpm dev                          # http://localhost:3000
```

L'admin est servi sous `http://localhost:3000/<ADMIN_PATH>` ; `/admin` renvoie volontairement une 404.

## Qualité

| Commande                | Rôle                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm check`            | lint + format + types + tests unitaires (à lancer avant chaque commit) |
| `pnpm test`             | tests unitaires (Vitest)                                               |
| `pnpm test:integration` | tests d'intégration sur la base `coussin_test` (vidée à chaque test)   |
| `pnpm test:e2e`         | tests E2E (Playwright) sur un build de production local                |
| `pnpm format`           | formate le code (Prettier)                                             |
| `pnpm audit`            | vulnérabilités connues des dépendances                                 |

La CI GitHub Actions rejoue tout cela à chaque push, plus l'application des migrations sur une base vierge.

## Paiement en local (Stripe, mode test)

1. Renseigner dans `.env` les clés **de test** : `STRIPE_SECRET_KEY` (`sk_test_…`) et `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Installer la [CLI Stripe](https://docs.stripe.com/stripe-cli) puis relayer les webhooks :
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe` — copier le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.
3. Payer avec la carte de test `4242 4242 4242 4242` (date future, CVC quelconque).

Sans clé Resend, les emails sont écrits dans `.data/emails/` (HTML + pièces jointes) ; sans jeton Vercel Blob, les factures PDF vont dans `.data/private/`.

Parcours d'achat E2E réel : `stripe listen --forward-to localhost:3100/api/webhooks/stripe` puis `E2E_STRIPE=1 pnpm test:e2e achat-stripe`.

Une clé `sk_live_` est refusée tant que `STRIPE_LIVE_ENABLED` ne vaut pas `true` (réservé à la phase 8).

## Base de données

| Commande           | Rôle                                                      |
| ------------------ | --------------------------------------------------------- |
| `pnpm db:migrate`  | crée/applique une migration en dev (`prisma migrate dev`) |
| `pnpm db:deploy`   | applique les migrations existantes (CI, production)       |
| `pnpm db:generate` | régénère le client Prisma                                 |

Les migrations destructives ne sont jamais appliquées en production sans validation explicite.

## Déploiement

Hébergement Vercel (plan Pro, région `fra1`), base Neon Francfort. La procédure complète (variables, domaine, Stripe live) sera détaillée en phase 8 ; aucune mise en production sans accord explicite.
