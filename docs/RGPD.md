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

Un cron de rétention (phase 5/7) purge ou anonymise selon les durées ci-dessus. Les factures ne sont jamais supprimées avant 10 ans ; une demande d'effacement anonymise le client sans toucher aux pièces comptables.
