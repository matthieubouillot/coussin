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

| Commande        | Rôle                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `pnpm check`    | lint + format + types + tests unitaires (à lancer avant chaque commit) |
| `pnpm test`     | tests unitaires (Vitest)                                               |
| `pnpm test:e2e` | tests E2E (Playwright) sur un build de production local                |
| `pnpm format`   | formate le code (Prettier)                                             |
| `pnpm audit`    | vulnérabilités connues des dépendances                                 |

La CI GitHub Actions rejoue tout cela à chaque push, plus l'application des migrations sur une base vierge.

## Base de données

| Commande           | Rôle                                                      |
| ------------------ | --------------------------------------------------------- |
| `pnpm db:migrate`  | crée/applique une migration en dev (`prisma migrate dev`) |
| `pnpm db:deploy`   | applique les migrations existantes (CI, production)       |
| `pnpm db:generate` | régénère le client Prisma                                 |

Les migrations destructives ne sont jamais appliquées en production sans validation explicite.

## Déploiement

Hébergement Vercel (plan Pro, région `fra1`), base Neon Francfort. La procédure complète (variables, domaine, Stripe live) sera détaillée en phase 8 ; aucune mise en production sans accord explicite.
