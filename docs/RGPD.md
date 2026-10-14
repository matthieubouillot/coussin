# Registre des traitements (simplifié)

> Tenu par : [À COMPLÉTER : nom de l'entrepreneur], responsable du traitement. Mis à jour à chaque nouvelle finalité ou nouveau prestataire.
> Version publique : page `/confidentialite`.

| #   | Traitement          | Finalité                                          | Base légale       | Personnes / données                                | Destinataires                                                                    | Durée                              | Hors UE                                                                                            |
| --- | ------------------- | ------------------------------------------------- | ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Commandes           | Vente, livraison, service client, garanties       | Contrat           | Clients : nom, email, téléphone, adresse, commande | Vendeur, Stripe, fournisseur (AliExpress/CJ), transporteur, Resend, Neon, Vercel | Relation + 3 ans                   | Oui : fournisseur en Chine (art. 49.1.b, nécessaire au contrat) ; Stripe/Resend/Vercel (DPF / CCT) |
| 2   | Comptabilité        | Factures, livre des recettes, registre des achats | Obligation légale | Clients : identité, montants, mode de paiement     | Vendeur, comptable                                                               | 10 ans                             | Non (Neon UE)                                                                                      |
| 3   | Avis clients        | Collecte et publication d'avis vérifiés           | Intérêt légitime  | Clients : email, prénom + initiale, avis           | Public (avis), Resend                                                            | Tant que publié ; invitation 3 ans | Resend (CCT)                                                                                       |
| 4   | Contact             | Réponse aux demandes                              | Intérêt légitime  | Visiteurs : nom, email, message                    | Vendeur, Resend                                                                  | 1 an                               | Resend (CCT)                                                                                       |
| 5   | Sécurité            | Anti-abus, anti-fraude, erreurs techniques        | Intérêt légitime  | Visiteurs : IP hachée, données techniques          | Upstash, Cloudflare Turnstile, Sentry (sans PII)                                 | 30 jours                           | Cloudflare (DPF)                                                                                   |
| 6   | Consentement        | Preuve du choix cookies                           | Obligation légale | Identifiant aléatoire, choix, version              | Neon                                                                             | 6 mois                             | Non                                                                                                |
| 7   | Publicité (phase 6) | Mesure des campagnes                              | Consentement      | Événements de navigation et d'achat                | TikTok (Meta si activé)                                                          | 13 mois max                        | Oui (à documenter en phase 6)                                                                      |
| 8   | Administration      | Accès au back-office                              | Intérêt légitime  | Admin : email, journal d'audit                     | Neon                                                                             | Audit 1 an                         | Non                                                                                                |

## Mesures de sécurité

Voir [`SECURITY.md`](SECURITY.md).

## Durées appliquées automatiquement

Purge quotidienne (`src/server/gdpr/retention.ts`, appelée par `/api/cron/daily`), testée dans `tests/integration/retention.test.ts` :

| Donnée                                                    | Durée                     | Action                                      |
| --------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| Clients sans activité (ni commande ni contact)            | 3 ans                     | Anonymisation (factures intactes)           |
| Messages du formulaire de contact                         | 1 an                      | Suppression                                 |
| Journal d'audit admin                                     | 1 an                      | Suppression                                 |
| Preuves de consentement cookies                           | 6 mois                    | Suppression                                 |
| Événements de webhook traités (journal technique)         | 90 jours                  | Suppression                                 |
| Invitations à laisser un avis expirées                    | 30 jours après expiration | Suppression                                 |
| Sessions admin et jetons de vérification expirés          | à expiration              | Suppression                                 |
| Contexte publicitaire d'un panier abandonné               | 1 jour                    | Effacement                                  |
| Factures, avoirs, livre des recettes, registre des achats | 10 ans                    | **Jamais supprimés** (obligation comptable) |

Une demande d'effacement d'un client se traite dans l'admin (Clients → Anonymiser) ; une demande d'accès ou de portabilité par l'export JSON. Délai de réponse : 1 mois.

## Vérification RGPD (14 octobre 2026)

| Exigence                      | État                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Données et traitements en UE  | Base Neon et fonctions Vercel à Francfort ; sous-traitants hors UE listés avec leurs garanties (politique de confidentialité)             |
| Minimisation                  | Seules les données utiles à la commande et à la livraison ; IP uniquement hachée ; contexte publicitaire effacé après usage               |
| Bandeau cookies conforme CNIL | Refuser aussi simple qu'accepter, choix granulaire, aucun traceur avant consentement (testé), choix mémorisé 6 mois, lien sur chaque page |
| Durées de conservation        | Appliquées automatiquement (ci-dessus)                                                                                                    |
| Droits des personnes          | Export JSON et anonymisation dans l'admin                                                                                                 |
| Registre des traitements      | Ce document                                                                                                                               |
| Sécurité                      | `SECURITY.md`, `SECURITY_REVIEW.md`                                                                                                       |
