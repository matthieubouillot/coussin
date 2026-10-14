# Sauvegardes et restauration

## Ce qui est sauvegardé, et par qui

| Donnée                                                    | Où                   | Sauvegarde                                                                                                                                                                                               |
| --------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base PostgreSQL (commandes, factures, clients, réglages…) | Neon, Francfort      | **Automatique** : historique continu (PITR) selon le plan Neon (restauration à la seconde près dans la fenêtre de rétention). Plan payant recommandé : fenêtre de 7 à 30 jours.                          |
| Factures et avoirs PDF                                    | Vercel Blob (privé)  | Régénérables à l'identique depuis la base (snapshots figés) ; l'empreinte SHA-256 stockée permet de vérifier un fichier.                                                                                 |
| Photos et vidéos produit                                  | Vercel Blob (public) | Garder les originaux sur ton ordinateur ou un cloud personnel.                                                                                                                                           |
| Code                                                      | GitHub (privé)       | Historique Git complet.                                                                                                                                                                                  |
| Secrets (`.env`)                                          | Vercel               | À recopier dans un gestionnaire de mots de passe : **`SECRETS_ENCRYPTION_KEY` en particulier** (sans elle, les jetons fournisseur stockés sont illisibles — il suffit alors de reconnecter les comptes). |

En complément du PITR, un export mensuel hors de Neon est recommandé (commande ci-dessous), conservé chiffré sur un autre support.

## Restaurer la production (Neon)

Principe : **ne jamais restaurer par-dessus la base en service.** On restaure dans une branche, on vérifie, puis on bascule.

1. Neon → projet → **Branches** → _Create branch_ → « Point in time » : choisir l'instant juste **avant** l'incident.
2. Récupérer l'URL de connexion de cette branche et lancer les vérifications ci-dessous dessus.
3. Mettre la boutique en pause si nécessaire (désactiver le produit dans l'admin pour stopper les ventes).
4. Vercel → Settings → Environment Variables : remplacer `DATABASE_URL` et `DIRECT_URL` par ceux de la branche restaurée, puis **Redeploy**.
5. Vérifier l'admin (dernières commandes, dernière facture), puis réactiver le produit.
6. Les paiements Stripe reçus entre l'instant restauré et maintenant : Stripe → Developers → Webhooks → **renvoyer** les événements de la période (le traitement est idempotent : rien n'est créé deux fois).

## Export manuel et restauration hors Neon

```bash
# Export (format compressé, restaurable avec pg_restore)
pg_dump --format=custom --no-owner --file=coussin-$(date +%F).dump "$DIRECT_URL"

# Restauration dans une base VIDE (jamais dans la base en service)
createdb coussin_restauree
pg_restore --no-owner --dbname=coussin_restauree coussin-AAAA-MM-JJ.dump
```

## Vérifications après restauration

```sql
-- Volumes cohérents avec ce qu'on attend
SELECT count(*) FROM "Order"; SELECT count(*) FROM "Invoice";
-- Numérotation des factures sans trou, par série
SELECT series, "lastNumber" FROM "InvoiceSequence";
-- Les protections des factures sont bien présentes
SELECT tgname FROM pg_trigger WHERE tgname LIKE 'invoice_immutable%';
-- Toutes les migrations sont appliquées
SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 3;
```

## Exercice réalisé (14 octobre 2026, base de développement)

| Étape                                                                                                        | Résultat                                                     |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Export `pg_dump` (format custom)                                                                             | 107 Ko                                                       |
| Restauration dans une base vierge                                                                            | 3 secondes                                                   |
| Comparaison des tables (commandes, factures, clients, envois fournisseur, achats, comptes admin, migrations) | identiques                                                   |
| Triggers d'immuabilité des factures                                                                          | présents et actifs (une modification de facture est refusée) |

À refaire **avant la mise en production** sur Neon (restauration d'une branche à un instant donné), puis une fois par an.
