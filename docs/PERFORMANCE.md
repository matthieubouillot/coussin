# Performance et charge

## Lighthouse (mobile, build de production local, 14 octobre 2026)

| Page          | Performance | Accessibilité | Bonnes pratiques | SEO | LCP simulé | CLS | TBT   |
| ------------- | ----------- | ------------- | ---------------- | --- | ---------- | --- | ----- |
| `/` (produit) | 97          | 100           | 100              | 100 | 2,7 s      | 0   | 30 ms |
| `/cgv`        | 97          | 100           | 100              | 100 | 2,6 s      | 0   | 20 ms |
| `/contact`    | 97          | 100           | 100              | 100 | 2,6 s      | 0   | 20 ms |
| `/panier`     | 97          | 100           | 100              | 63* | 2,6 s      | 0   | 20 ms |

\* Le panier est volontairement exclu de l'indexation (`noindex`, robots.txt) : la note SEO le reflète.

Le LCP « simulé » correspond à une 4G lente émulée par Lighthouse ; mesuré dans un vrai navigateur sans bridage, il est de 0,12 s. À re-mesurer en production (vrai CDN Vercel, vraies photos produit), puis à suivre dans Vercel Speed Insights.

Accessibilité : contrôle automatique WCAG 2.2 AA (axe-core) intégré aux tests E2E sur 8 pages publiques et l'écran de connexion admin ; un test manuel au clavier et au lecteur d'écran reste à faire avant la mise en ligne.

## Test de charge léger (14 octobre 2026)

Environnement : build de production sur MacBook (Apple Silicon), base PostgreSQL locale, faux serveur Stripe (`scripts/stripe-mock.mjs`). Chaque client simulé a sa propre adresse IP.

| Scénario                                                                              | Résultat                                                                                                                                                       |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page produit : 50 visiteurs simultanés pendant 15 s                                   | 4 241 pages servies, **283 pages/s**, médiane 169 ms, p95 222 ms, p99 297 ms, **0 erreur**                                                                     |
| 30 clients qui passent commande **au même moment** (ajout au panier → CGV → paiement) | **30/30 redirigés vers le paiement**, 30 commandes distinctes en base, numéros tous différents ; parcours complet médian 5,0 s (navigateur automatisé compris) |
| Un même client qui enchaîne 12 tentatives de paiement                                 | 10 acceptées, **2 bloquées** par la limite de débit (10 / 10 min)                                                                                              |

Ordre de grandeur : une campagne TikTok qui amène plusieurs centaines de visiteurs par minute reste très en dessous de ces chiffres, et Vercel ajoute des instances automatiquement. Le point à surveiller en production est le nombre de connexions à la base : utiliser l'URL **poolée** de Neon pour `DATABASE_URL` (déjà prévu).

### Relancer le test

```bash
node scripts/stripe-mock.mjs &
# serveur de production sur une base de test, branché sur le faux Stripe
DATABASE_URL=…/coussin_test DIRECT_URL=…/coussin_test STRIPE_SECRET_KEY=sk_test_mock \
  STRIPE_API_BASE=http://localhost:12111 NEXT_PUBLIC_SITE_URL=http://localhost:3300 pnpm start --port 3300 &
npx tsx scripts/load-test.mts http://localhost:3300
```

`STRIPE_API_BASE` est refusé en production par la validation des variables d'environnement.
