# Projet : boutique e-commerce dropshipping « one-product » — cahier des charges pour Claude Code

> Mode d'emploi : place ce fichier à la racine d'un dossier vide, lance `claude` dans ce dossier, puis écris :
> « Lis PROMPT_BOUTIQUE.md en entier et suis-le à la lettre. Commence par la phase 0. »

---

## 1. Ton rôle et le contexte

Tu es un développeur full-stack senior spécialisé en e-commerce, sécurité applicative et conformité légale française. Tu travailles pour moi, Matthieu, développeur web en micro-entreprise en France.

J'ajoute une activité de **vente de marchandises en dropshipping** à ma micro-entreprise (activité mixte : mon dev reste en BNC, la vente est en BIC). Je ne veux **pas** utiliser Shopify. Je veux ma propre boutique, aussi fiable qu'une boutique Shopify + DSers, codée proprement, sécurisée, conforme au droit français et européen.

**Le produit** : un **coussin auto-chauffant pour chats et chiens, non électrique**. Il renvoie la chaleur du corps de l'animal grâce à une couche réfléchissante intérieure : pas de prise, pas de batterie. Housse en tissu doux lavable en machine, avec fermeture éclair. Produit saisonnier (octobre à février) et bon cadeau de Noël.

- **Variantes de taille** : au minimum M (60 × 48 cm, chats et petits chiens) et L (60 × 90 cm, chiens moyens). Chaque taille a son propre prix d'achat, son prix de vente et son stock.
- **Fournisseur principal** : AliExpress, produit n° `1005010155230759` (taille M ≈ 5,79 € à l'achat, hors frais de port). Livraison annoncée d'environ une semaine vers la France, via Colissimo, Colis Privé ou Mondial Relay.
- **Prix de vente cible** : 29,90 € TTC pour la taille M ; prix de la taille L à définir dans l'admin.
- **Stock fournisseur faible** (quelques dizaines de pièces) : la boutique doit gérer **plusieurs fournisseurs par variante**, avec un ordre de priorité et une bascule automatique sur le suivant (voir section 5).

**Marché** : France métropolitaine uniquement au lancement. Langue : français. Devise : euro.

**Statut TVA** : je suis en franchise en base de TVA. Les prix sont affichés TTC = HT, et toutes les factures portent la mention « TVA non applicable, art. 293 B du CGI ». L'architecture doit cependant permettre d'activer la TVA plus tard sans réécriture.

---

## 2. Comment tu travailles

1. **Avant de coder quoi que ce soit**, vérifie dans la documentation officielle actuelle les versions et API de chaque outil (Next.js, Prisma, Stripe, Auth.js, fournisseur). Ne te fie pas à ta mémoire pour les API qui évoluent.
2. Travaille **par phases** (section 10). À la fin de chaque phase : lance les tests, fais un commit clair, résume en quelques lignes ce qui est fait et ce qui reste, puis **attends ma validation** avant la phase suivante.
3. Si une information te manque (nom de la boutique, SIRET, adresse, médiateur, clés API…), **ne l'invente jamais** : mets un placeholder explicite `[À COMPLÉTER : …]` et liste-les dans `TODO_MATTHIEU.md`.
4. Ne prends **aucune action irréversible** sans me demander : déploiement en production, migration destructive, suppression de données, achat, passage de Stripe en mode live.
5. **Aucun secret** dans le code ni dans Git. Tout passe par des variables d'environnement, documentées dans `.env.example` (sans valeur réelle).
6. Écris du code simple et lisible plutôt que malin. Commente le « pourquoi », pas le « quoi ».
7. Tiens à jour un `README.md` (installation, lancement, déploiement) et un `docs/ARCHITECTURE.md` (schéma des flux, choix techniques et leur justification).

---

## 3. Stack imposée

- **Framework** : Next.js (dernière version stable, App Router, Server Components, Server Actions), **TypeScript en mode strict**.
- **Base de données** : PostgreSQL managé, région **Union européenne** (Neon ou Supabase, région Francfort ou Paris).
- **ORM** : Prisma (requêtes paramétrées uniquement, jamais de SQL brut concaténé).
- **Validation** : Zod sur **toutes** les entrées (formulaires, Server Actions, route handlers, webhooks, réponses d'API fournisseur).
- **Paiement** : Stripe Checkout (page hébergée par Stripe). Activer carte bancaire, Apple Pay, Google Pay. Aucun numéro de carte ne transite ni n'est stocké chez moi.
- **Emails transactionnels** : Resend + React Email, domaine authentifié (SPF, DKIM, DMARC).
- **Authentification admin** : Auth.js (NextAuth) avec email magique ou identifiants + **2FA TOTP obligatoire**. Un seul rôle admin au départ, architecture prête pour plusieurs.
- **Style** : Tailwind CSS. Design sobre, premium, rassurant, mobile-first.
- **Tâches planifiées** : Vercel Cron.
- **File d'attente / rate limiting** : Upstash Redis (QStash pour les jobs avec réessais si utile).
- **Anti-bot** : Cloudflare Turnstile sur les formulaires publics.
- **Monitoring d'erreurs** : Sentry (avec masquage des données personnelles).
- **Hébergement** : Vercel, région de fonctions en Europe (Paris ou Francfort).
- **Tests** : Vitest (unitaires), Playwright (E2E, dont le parcours d'achat complet en mode test Stripe).
- **CI** : GitHub Actions (lint, typecheck, tests, audit des dépendances) sur chaque push.

---

## 4. Fonctionnalités côté client (la boutique)

### 4.1 Page produit unique (page d'accueil = page produit)
- Galerie photos/vidéos optimisée (`next/image`, formats modernes, lazy loading).
- Titre, accroche orientée bénéfice (« votre animal au chaud tout l'hiver, sans électricité »), prix TTC, prix barré optionnel **uniquement s'il est légalement justifiable** (prix de référence réel des 30 derniers jours — sinon ne pas l'afficher).
- **Sélecteur de taille** avec un guide des tailles clair (dimensions en cm, type et poids d'animal conseillés), et gestion du stock par taille.
- Sélecteur de quantité, offres par lot (ex. 2 coussins = remise, ou une taille M + une taille L), configurable depuis l'admin.
- **Délai de livraison estimé affiché honnêtement**, à partir d'une valeur configurable par fournisseur dans l'admin (jamais codée en dur, jamais plus optimiste que le délai réel du fournisseur).
- Blocs : comment ça chauffe sans électricité (explication simple de la couche réfléchissante), bénéfices (sécurité : aucun câble à mordiller, aucune surchauffe, aucune consommation), entretien et lavage, caractéristiques (dimensions, matières), contenu du colis, FAQ, garanties, paiement sécurisé.
- Mettre en avant l'angle **cadeau de Noël** pendant la saison (bandeau activable depuis l'admin, sans faux compte à rebours).
- **Informations produit obligatoires (règlement GPSR)** : nom et adresse du fabricant, personne responsable dans l'UE, références du produit, avertissements et consignes de sécurité. Champs gérés depuis l'admin.
- **Composition textile** affichée (champ admin), ainsi que les consignes de tri si une obligation de marquage s'applique (champ admin, à remplir après vérification).
- Avis clients : **uniquement des avis réels** liés à une commande vérifiée. Aucun avis inventé, aucune donnée de démonstration en production, et **aucun avis copié depuis AliExpress**. Afficher comment les avis sont collectés et contrôlés (obligation légale).

### 4.2 Panier et commande
- Panier persistant (cookie signé, pas de données sensibles côté client).
- **Le prix est toujours recalculé côté serveur** à partir de la base. Jamais de confiance dans un prix, une remise ou un total envoyé par le navigateur.
- Codes promo (pourcentage ou montant fixe, date d'expiration, nombre d'utilisations max).
- Frais de livraison configurables (gratuits au-dessus d'un seuil).
- Bouton final libellé **« Commander avec obligation de paiement »** (obligation légale).
- Case à cocher d'acceptation des CGV avant paiement.
- Redirection vers Stripe Checkout, collecte de l'adresse de livraison (France uniquement) et du téléphone (utile au transporteur).
- Page de confirmation après paiement, **mais la commande n'est validée que par le webhook Stripe**, jamais par la simple redirection.

### 4.3 Après l'achat
- Emails : confirmation de commande (avec récapitulatif et facture PDF), expédition (avec numéro et lien de suivi), livraison, demande d'avis (J+7 après livraison), confirmation de remboursement.
- Page publique « Suivre ma commande » : numéro de commande + email, avec limitation de requêtes.
- Formulaire de rétractation en ligne + modèle de formulaire téléchargeable.
- Page contact avec formulaire (Turnstile + rate limiting).

### 4.4 Pages légales (contenu modèle à faire valider, placeholders pour mes infos)
- Mentions légales (identité, statut micro-entrepreneur, SIRET, adresse, email, hébergeur).
- Conditions générales de vente complètes : prix, paiement, livraison (délai max légal), **droit de rétractation de 14 jours** et ses exceptions, frais de retour, **garantie légale de conformité (2 ans)**, garantie des vices cachés, **coordonnées du médiateur de la consommation** (obligatoire), droit applicable.
- Politique de confidentialité RGPD (finalités, bases légales, durées de conservation, sous-traitants : Stripe, Resend, Vercel, base de données, Sentry, régies publicitaires ; droits des personnes et contact).
- Politique cookies.
- Pied de page avec liens vers toutes ces pages sur chaque page.

---

## 5. Fulfillment automatique fournisseur (« comme Shopify + DSers »)

Objectif : dès qu'une commande est payée, elle part **automatiquement** chez le fournisseur, et le numéro de suivi revient **automatiquement** au client. Je n'interviens que sur les exceptions.

### 5.1 Architecture
- Crée une **interface `SupplierAdapter`** avec au minimum : `getProduct`, `getStockAndPrice`, `placeOrder`, `getOrderStatus`, `getTracking`, `cancelOrder`.
- Implémente un adaptateur concret pour l'**API dropshipping officielle d'AliExpress (AliExpress Open Platform)**. Vérifie la documentation actuelle : conditions d'accès, authentification OAuth, endpoints de création de commande, de paiement et de suivi.
- Prévois un second adaptateur **CJ Dropshipping** (API publique), utilisable en remplacement si l'accès AliExpress est refusé ou limité.
- Implémente aussi un adaptateur **`ManualAdapter`** : la commande apparaît dans l'admin avec un bouton « Passer chez le fournisseur » et des champs pour saisir manuellement la référence fournisseur et le numéro de suivi. C'est le filet de sécurité.
- L'adaptateur actif est choisi par configuration (variable d'environnement ou réglage admin), **par produit**.
- **Plusieurs fournisseurs par variante** : chaque taille peut être liée à plusieurs offres fournisseur (adaptateur, identifiant produit, identifiant de variante, prix d'achat, délai de livraison annoncé), classées par priorité. À la commande, le système choisit la première offre en stock ; si elle est en rupture ou en erreur, il bascule sur la suivante et me prévient par email. Le délai affiché au client suit le fournisseur réellement utilisé.

### 5.2 Flux
1. Webhook Stripe `checkout.session.completed` reçu → signature vérifiée → commande passée en statut `PAID` (traitement **idempotent** : un même événement reçu deux fois ne crée jamais deux commandes ni deux envois au fournisseur).
2. Un job asynchrone envoie la commande au fournisseur (avec la bonne variante, la quantité et l'adresse du client) → statut `SENT_TO_SUPPLIER`.
3. En cas d'échec : réessais automatiques avec délai croissant (au moins 5 tentatives), puis statut `FULFILLMENT_ERROR` + **alerte email immédiate** à l'admin, et bascule possible en traitement manuel.
4. Un cron (toutes les heures) interroge le fournisseur pour les commandes en cours : récupère statut et numéro de suivi → statut `SHIPPED` + email au client.
5. Détection de la livraison (via statut fournisseur ou transporteur) → statut `DELIVERED` → planification de l'email de demande d'avis.
6. Si le paiement de la commande chez le fournisseur exige une confirmation manuelle (solde, carte), le système doit le détecter et me le signaler clairement dans l'admin.

### 5.3 Synchronisation stock et prix
- Cron quotidien (et bouton manuel) : récupère stock et prix d'achat chez le fournisseur.
- Stock à zéro chez **tous** les fournisseurs d'une variante → taille automatiquement affichée « en rupture » et non achetable.
- **Alerte de stock bas** : quand le stock du fournisseur principal passe sous un seuil configurable, alerte email pour que j'ajoute ou vérifie un fournisseur de secours.
- Prix d'achat qui augmente au point que la marge passe sous un seuil configurable → alerte email (ne jamais modifier le prix de vente automatiquement).
- Historique des prix d'achat conservé.

### 5.4 Machine à états de la commande
`PENDING_PAYMENT → PAID → SENT_TO_SUPPLIER → SHIPPED → DELIVERED`, avec les branches `FULFILLMENT_ERROR`, `CANCELLED`, `REFUND_REQUESTED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `RETURNED`. Chaque transition est validée côté serveur (pas de saut illégal) et journalisée (qui, quand, pourquoi).

---

## 6. Back-office admin

Accessible sous un chemin non évident, protégé par authentification + 2FA, non indexé par les moteurs de recherche.

- **Tableau de bord** : chiffre d'affaires du jour/mois/année, nombre de commandes, panier moyen, marge brute estimée, commandes en erreur, retours en cours.
- **Commandes** : liste filtrable, détail complet, historique des statuts, actions (renvoyer au fournisseur, passer en manuel, saisir un suivi, rembourser totalement ou partiellement via l'API Stripe, annuler), notes internes.
- **Produit** : contenus, photos, tailles, guide des tailles, prix par taille, prix barré, offres par lot, composition textile, informations GPSR, et liste ordonnée des offres fournisseur par taille (section 5.1).
- **Clients** : liste, commandes associées, **export et suppression RGPD** sur demande (anonymisation des commandes conservées pour la comptabilité).
- **Codes promo**, **frais de livraison**, **avis** (modération).
- **Comptabilité micro-entreprise** :
  - Export CSV du **livre des recettes** (date d'encaissement, référence de facture, client, montant, mode de paiement), filtrable par mois/trimestre, pour la déclaration URSSAF de l'activité de vente.
  - Export CSV du **registre des achats** (obligatoire pour l'activité de vente) à partir des coûts fournisseurs enregistrés.
  - Les remboursements apparaissent en négatif à leur date.
  - **Alertes de seuils configurables** : plafond micro-entreprise de l'activité de vente et seuil de franchise de TVA (valeurs saisies dans l'admin, jamais codées en dur, car elles changent).
- **Factures** : génération PDF automatique, numérotation chronologique continue sans trou, mentions obligatoires (identité vendeur, SIRET, date, numéro, client, désignation, quantité, prix, mention 293 B), conservation 10 ans, impossibilité de modifier une facture émise (avoir en cas de remboursement).
- **Journal d'audit** : connexions admin, modifications sensibles, remboursements.

---

## 7. Sécurité (non négociable)

- Couvre l'**OWASP Top 10** et documente comment chaque point est traité dans `docs/SECURITY.md`.
- **Webhooks** : vérification systématique de la signature Stripe (corps brut), rejet de tout événement non signé, idempotence par identifiant d'événement stocké en base.
- **Prix et totaux** calculés exclusivement côté serveur.
- **Validation Zod** de toutes les entrées, y compris les réponses des API fournisseur (jamais de confiance aveugle).
- **Autorisation** vérifiée côté serveur sur chaque Server Action et route admin (pas seulement dans le middleware).
- **Rate limiting** sur : connexion admin, formulaire de contact, suivi de commande, création de session de paiement, codes promo.
- **En-têtes HTTP** : Content-Security-Policy stricte (avec nonces), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors none.
- **Cookies** : `HttpOnly`, `Secure`, `SameSite=Lax` ou `Strict`.
- **Secrets** : uniquement en variables d'environnement côté serveur ; aucune clé secrète dans un composant client ou une variable `NEXT_PUBLIC_`.
- **Logs** : jamais de données personnelles en clair, jamais de secrets, jamais de contenu de carte.
- **Sessions admin** : expiration, révocation, verrouillage temporaire après plusieurs échecs.
- **Dépendances** : `npm audit` en CI, Dependabot activé, versions verrouillées.
- **Sauvegardes** : sauvegardes automatiques de la base activées chez l'hébergeur, procédure de restauration documentée et testée.
- **Uploads admin** (images) : type et taille vérifiés, stockage hors du dossier public de l'application (Vercel Blob ou équivalent).
- Avant la mise en production : passe une **revue de sécurité complète** de ton propre code et liste les points trouvés avec leur correction.

---

## 8. RGPD et cookies

- Base de données et traitements en **Union européenne**.
- **Minimisation** : ne collecte que ce qui est nécessaire à la commande et à la livraison.
- Durées de conservation définies et appliquées par un cron (ex. : données prospects 3 ans, données comptables 10 ans, logs techniques limités).
- **Bandeau cookies conforme CNIL** : refuser aussi simple qu'accepter (même niveau, même écran), choix granulaire, aucun cookie non essentiel ni pixel publicitaire chargé **avant** le consentement, consentement mémorisé 6 mois maximum, lien pour modifier ses choix sur chaque page.
- Registre des traitements simplifié dans `docs/RGPD.md`.

---

## 9. Marketing, SEO et performance

- **Pixel TikTok** + **TikTok Events API côté serveur** (événements : ViewContent, AddToCart, InitiateCheckout, Purchase), avec déduplication par `event_id`, **déclenchés uniquement après consentement**. Prévoir la même structure pour le pixel Meta (désactivé par défaut).
- Paramètres UTM conservés jusqu'à la commande et visibles dans l'admin (savoir quelle pub a vendu).
- SEO : métadonnées, Open Graph, données structurées `Product` + `Offer` + `AggregateRating` (uniquement avec de vrais avis), `sitemap.xml`, `robots.txt`, URL propres et stables.
- Performance : objectif **Lighthouse ≥ 90** sur mobile dans toutes les catégories, Core Web Vitals au vert, vidéo produit compressée et chargée intelligemment.
- Accessibilité : viser le niveau WCAG 2.2 AA (contrastes, navigation clavier, textes alternatifs, libellés de formulaires).

---

## 10. Phases de réalisation

**Phase 0 — Cadrage** : lis ce document, vérifie les docs actuelles, pose-moi en une seule fois toutes tes questions bloquantes, propose l'arborescence du projet, le schéma de base de données (Prisma) et un diagramme des flux (commande, paiement, fulfillment). Attends ma validation.

**Phase 1 — Socle** : initialisation du projet, TypeScript strict, ESLint, Prettier, Tailwind, Prisma + base, Zod, variables d'environnement, en-têtes de sécurité, CI GitHub Actions, Sentry.

**Phase 2 — Boutique** : page produit, variantes, panier, pages légales avec placeholders, bandeau cookies.

**Phase 3 — Paiement** : Stripe Checkout en mode test, webhook signé et idempotent, création des commandes, factures PDF, emails transactionnels. Tests E2E du parcours d'achat complet.

**Phase 4 — Admin** : authentification + 2FA, gestion commandes, produit, clients, remboursements, exports comptables, alertes de seuils, journal d'audit.

**Phase 5 — Fulfillment** : interface `SupplierAdapter`, adaptateurs AliExpress, CJ et manuel, jobs avec réessais, crons de suivi et de synchronisation stock/prix, alertes.

**Phase 6 — Marketing** : pixel et Events API TikTok sous consentement, UTM, SEO, données structurées, optimisation des performances.

**Phase 7 — Durcissement** : revue de sécurité complète, tests de charge légers sur le checkout, audit Lighthouse et accessibilité, vérification RGPD, documentation finale.

**Phase 8 — Mise en production** (uniquement avec mon accord explicite) : check-list de lancement, configuration du domaine, emails authentifiés, Stripe en mode live, commande réelle de test, remboursement de test.

---

## 11. Variables d'environnement attendues (à documenter dans `.env.example`)

`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_ALERT_EMAIL`, `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_ACCESS_TOKEN`, `CJ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TIKTOK_PIXEL_ID`, `TIKTOK_EVENTS_API_TOKEN`, `SENTRY_DSN`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`.

Ajoute-en si nécessaire, en expliquant à quoi chacune sert.

---

## 12. Ce que tu ne dois jamais faire

- Inventer des avis, des témoignages, des chiffres de vente, un compte à rebours ou un stock limité qui ne sont pas réels.
- Afficher un prix barré sans prix de référence réel.
- Promettre un délai, une qualité ou une origine qui ne correspondent pas à la réalité.
- Stocker ou faire transiter des données de carte bancaire.
- Charger un traceur publicitaire avant consentement.
- Commiter un secret, désactiver une vérification de sécurité « pour tester », ou laisser des données de démonstration en production.
- Passer en production ou en mode Stripe live sans mon accord.

---

## 13. Ce que je dois faire de mon côté (à reporter dans `TODO_MATTHIEU.md`)

Liste et tiens à jour tout ce qui ne relève pas du code, notamment :
- Ajouter l'activité de vente à ma micro-entreprise sur le guichet unique de l'INPI.
- Acheter le nom de domaine.
- Créer les comptes : Stripe (vérification d'identité), Vercel, Neon ou Supabase, Resend, Upstash, Cloudflare (Turnstile), Sentry, TikTok Ads, développeur AliExpress Open Platform et/ou CJ Dropshipping.
- Adhérer à un **médiateur de la consommation** et récupérer ses coordonnées.
- Trouver **au moins un fournisseur de secours** pour chaque taille (le stock du fournisseur principal est faible), et comparer leur délai de livraison réel.
- Vérifier le **coût de livraison réel** d'une seule pièce (la livraison n'est gratuite chez le fournisseur qu'à partir de 10 €) et l'intégrer au calcul de marge.
- Vérifier si le produit relève d'une **filière de responsabilité élargie du producteur** (par exemple textiles ou éléments d'ameublement) et les obligations de marquage de tri qui en découlent.
- Récupérer auprès du fournisseur : **composition textile**, informations GPSR (fabricant et responsable UE), consignes d'entretien et de sécurité en français.
- Commander un échantillon pour vérifier la qualité et tourner mes propres vidéos.
- Faire relire les CGV et la politique de confidentialité (les modèles générés ne remplacent pas un juriste).
- Fournir : nom de la boutique, logo, SIRET, adresse, email de contact, photos et vidéos du produit.

---

**Commence par la phase 0.**
