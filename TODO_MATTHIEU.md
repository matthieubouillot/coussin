# À faire de ton côté (hors code)

> Mis à jour à chaque phase. Coche au fur et à mesure.

## Administratif et légal

- [ ] Ajouter l'activité de **vente de marchandises (BIC)** à ta micro-entreprise sur le guichet unique de l'INPI.
- [ ] Adhérer à un **médiateur de la consommation** et récupérer ses coordonnées (nom, adresse, site).
- [ ] Faire confirmer par ton comptable (si tu en as un) : la **série de factures dédiée `BTQ-`** distincte de tes factures BNC, et la **date d'encaissement** retenue pour le livre des recettes (date de paiement Stripe).
- [ ] Vérifier si le produit relève d'une **filière REP** (textiles / éléments d'ameublement) et les obligations de **marquage de tri** (Triman) qui en découlent.
- [ ] Faire relire les **CGV**, la **politique de confidentialité**, la **politique cookies**, les **mentions légales** et la page **avis clients** par un juriste (les modèles générés ne le remplacent pas). Points d'attention : encadré de garantie légale de conformité (texte réglementaire), transfert de l'adresse de livraison au fournisseur en Chine.
- [ ] Vérifier l'**adresse postale de Vercel Inc.** (hébergeur) sur vercel.com/legal pour les mentions légales.
- [ ] Choisir une **adresse de retour** en France pour les rétractations (frais de retour à la charge du client, validé en phase 0).

## Comptes à créer

- [ ] Nom de domaine
- [ ] **Vercel Pro** (le plan gratuit interdit l'usage commercial et les crons horaires) — région `fra1`
- [ ] **Neon** (région Francfort `eu-central-1`) — plan payant avant la prod pour une restauration (PITR) suffisante
- [ ] **Stripe** (vérification d'identité)
- [ ] **Resend** (+ configuration SPF, DKIM, DMARC sur le domaine)
- [ ] **Upstash** (Redis + QStash, région UE)
- [ ] **Cloudflare** (Turnstile)
- [ ] **Sentry** (choisir la **région UE** à la création de l'organisation)
- [ ] **TikTok Ads** (pixel + Events API)
- [ ] **AliExpress Open Platform** : créer une app « Dropshipping » et demander son approbation (délai de validation par AliExpress)
- [ ] **CJ Dropshipping** (fournisseur de secours)

## Produit et fournisseurs

- [ ] Trouver **au moins un fournisseur de secours par taille** (le stock du principal est faible) et comparer leur délai réel.
- [ ] Vérifier le **coût de livraison réel** d'une seule pièce (livraison gratuite chez le fournisseur seulement dès 10 €).
- [ ] Définir le **prix de vente de la taille L** et relever les **prix d'achat M et L**.
- [ ] Obtenir du fournisseur : **composition textile**, informations **GPSR** (fabricant, responsable UE), consignes d'entretien et de sécurité **en français**.
- [ ] Commander un **échantillon** : vérifier la qualité, tourner tes propres photos et vidéos.
- [ ] Confirmer le **guide des tailles** (poids d'animal conseillé par taille : les valeurs de dev sont fictives) et les **consignes de lavage** exactes.
- [ ] Remplir les **informations GPSR** avant la mise en ligne : la page affiche « en cours de vérification » tant qu'elles manquent, ce qui n'est pas acceptable en production.

## À fournir pour la boutique

- [ ] Nom de la boutique, logo, couleurs (sinon le design provisoire crème / brun / sauge reste)
- [ ] SIRET, adresse, email de contact
- [ ] Photos et vidéos du produit

## Stripe et emails (pour tester le paiement)

- [ ] Me fournir (dans `.env`, jamais par chat ni dans Git) les **clés de test Stripe** et, si possible, une **clé Resend** de test.
- [ ] Dans le dashboard Stripe : activer **Apple Pay** et **Google Pay** (moyens de paiement), puis plus tard vérifier le domaine pour Apple Pay.
- [ ] En production : créer l'endpoint webhook `https://<domaine>/api/webhooks/stripe` avec les événements `checkout.session.completed` et `checkout.session.expired`, **version d'API `2026-09-30.endive`**.
- [ ] Resend : vérifier le domaine d'envoi (SPF, DKIM, DMARC) et choisir l'adresse expéditrice.

## Fournisseurs (fulfillment automatique)

- [ ] **AliExpress Open Platform** : créer l'application « Dropshipping », la faire approuver, puis renseigner `ALIEXPRESS_APP_KEY` / `ALIEXPRESS_APP_SECRET`.
- [ ] Déclarer l'URL de retour OAuth dans l'application AliExpress : `https://<domaine>/api/admin/aliexpress/callback`, puis cliquer **« Connecter mon compte AliExpress »** dans Réglages.
- [ ] Enregistrer un **moyen de paiement par défaut** sur le compte AliExpress (pour le paiement automatique) — sinon chaque commande sera « à payer » (alerte email).
- [ ] ⚠️ **Tester une première commande réelle AliExpress avec moi** : les formats de l'API AliExpress n'ont pu être vérifiés que via un SDK communautaire (documentation officielle non lisible automatiquement). Le code est tolérant et passe en manuel au moindre doute, mais une vérification réelle est indispensable avant la prod.
- [ ] Dans chaque offre AliExpress, renseigner l'**ID produit**, l'**ID de variante** (bouton « Voir les variantes » sur la page Produit) et le **mode d'expédition** souhaité (ex. le nom du service Colissimo / Mondial Relay proposé par le vendeur).
- [ ] **CJ Dropshipping** (secours) : générer la clé API (`CJ_API_KEY`), approvisionner le **solde du portefeuille CJ**, renseigner pour chaque offre le `vid` et le `logisticName`, et saisir le **taux USD → EUR** dans Réglages.
- [ ] **Upstash QStash** : créer le compte et renseigner `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
- [ ] Générer `SECRETS_ENCRYPTION_KEY` (`openssl rand -base64 32`) et la conserver précieusement (sans elle, les jetons fournisseur stockés sont illisibles — il suffirait alors de reconnecter les comptes).

## Publicité (TikTok, plus tard Meta)

- [ ] **TikTok Ads Manager** : créer le pixel (Events Manager) et un jeton Events API → `TIKTOK_PIXEL_ID`, `TIKTOK_EVENTS_API_TOKEN`.
- [ ] Après activation : vérifier dans l'outil de test d'événements TikTok que ViewContent, AddToCart, InitiateCheckout et **Purchase** arrivent bien dédupliqués (navigateur + serveur). Si ton compte utilise encore « CompletePayment », me le dire (une ligne à changer).
- [ ] Vérifier dans le navigateur (outils de développement → Cookies) la liste exacte des cookies déposés par TikTok et la comparer à la politique cookies.
- [ ] Meta : désactivé. Pour l'activer plus tard : `META_PIXEL_ID`, `META_CAPI_TOKEN`, puis la case dans Réglages.

## Administration

- [ ] Installer une application TOTP (Aegis, 1Password, Google Authenticator…) et **conserver les codes de secours** hors du téléphone.
- [ ] Saisir dans l'admin (Réglages) les **seuils officiels de l'année** : plafond micro-entreprise vente et seuil de franchise de TVA (je ne les code pas en dur : ils changent).
- [ ] Remplir toute l'identité légale dans les Réglages (le paiement reste bloqué en production tant qu'il reste des « [À COMPLÉTER] »).

## Avant la mise en production (phase 8)

- [ ] Créer le dépôt GitHub privé (fait par Claude avec ton accord) et y brancher Vercel
- [ ] Renseigner toutes les variables de `.env.example` dans Vercel (Production + Preview)
- [ ] Créer ton compte admin de production avec `pnpm admin:create` (sur la base de production) et activer la 2FA.
- [ ] Ajouter l'événement webhook Stripe `refund.updated` (alerte si un remboursement échoue après coup).
