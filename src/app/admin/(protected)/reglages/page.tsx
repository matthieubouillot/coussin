import type { ReactNode } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { buttonClass, Card, Field, inputClass, Notice, PageTitle } from "@/components/admin/ui";
import { centsToInput } from "@/server/admin/form-helpers";
import { requireAdmin } from "@/server/auth/require-admin";
import { getShopConfig } from "@/server/settings/settings";
import { isPlaceholder } from "@/server/settings/legal-identity";
import { db } from "@/server/db";
import { saveSettingsAction } from "./actions";

const pct = (bps: number) => String(bps / 100).replace(".", ",");

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

export default async function SettingsPage() {
  await requireAdmin();
  const [config, row] = await Promise.all([
    getShopConfig(),
    db.shopSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  const l = config.legal;
  const incomplete = Object.values({ ...l, ...l.host, ...l.mediator }).some(
    (v) => typeof v === "string" && isPlaceholder(v),
  );

  return (
    <>
      <PageTitle>Réglages</PageTitle>
      {incomplete && (
        <Notice tone="warning">
          Des informations légales contiennent encore « [À COMPLÉTER] ». En production, le paiement reste
          bloqué tant qu&apos;elles ne sont pas renseignées.
        </Notice>
      )}
      <ActionForm
        action={saveSettingsAction}
        submitLabel="Enregistrer les réglages"
        submitClassName={buttonClass}
      >
        <Card title="Boutique">
          <Grid>
            <Field label="Nom de la boutique">
              <input name="shopName" defaultValue={config.shopName} required className={inputClass} />
            </Field>
            <Field label="Version des CGV (date)" hint="À changer à chaque modification des CGV">
              <input name="cgvVersion" defaultValue={config.cgvVersion} required className={inputClass} />
            </Field>
            <Field label="Texte du bandeau de saison" hint="Factuel, sans fausse urgence">
              <input
                name="christmasBannerText"
                defaultValue={row?.christmasBannerText ?? ""}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="christmasBannerEnabled"
                defaultChecked={row?.christmasBannerEnabled ?? false}
              />{" "}
              Afficher le bandeau
            </label>
          </Grid>
        </Card>

        <Card title="Identité légale (mentions légales, CGV, factures)">
          <Grid>
            <Field label="Prénom et nom de l'entrepreneur">
              <input name="sellerName" defaultValue={l.sellerName} required className={inputClass} />
            </Field>
            <Field label="Nom commercial">
              <input name="tradeName" defaultValue={l.tradeName} required className={inputClass} />
            </Field>
            <Field label="Statut">
              <input name="legalStatus" defaultValue={l.legalStatus} required className={inputClass} />
            </Field>
            <Field label="SIRET">
              <input name="siret" defaultValue={l.siret} required className={inputClass} />
            </Field>
            <Field label="Adresse du siège">
              <input name="address" defaultValue={l.address} required className={inputClass} />
            </Field>
            <Field label="Email de contact">
              <input name="email" defaultValue={l.email} required className={inputClass} />
            </Field>
            <Field label="Téléphone">
              <input name="phone" defaultValue={l.phone} required className={inputClass} />
            </Field>
            <Field label="Directeur de la publication">
              <input
                name="publicationDirector"
                defaultValue={l.publicationDirector}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Adresse de retour des colis">
              <input name="returnAddress" defaultValue={l.returnAddress} required className={inputClass} />
            </Field>
            <Field label="Hébergeur — nom">
              <input name="hostName" defaultValue={l.host.name} required className={inputClass} />
            </Field>
            <Field label="Hébergeur — adresse">
              <input name="hostAddress" defaultValue={l.host.address} required className={inputClass} />
            </Field>
            <Field label="Hébergeur — contact">
              <input name="hostContact" defaultValue={l.host.contact} required className={inputClass} />
            </Field>
            <Field label="Médiateur — nom">
              <input name="mediatorName" defaultValue={l.mediator.name} required className={inputClass} />
            </Field>
            <Field label="Médiateur — adresse">
              <input
                name="mediatorAddress"
                defaultValue={l.mediator.address}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Médiateur — site">
              <input
                name="mediatorWebsite"
                defaultValue={l.mediator.website}
                required
                className={inputClass}
              />
            </Field>
          </Grid>
        </Card>

        <Card title="Fiscalité et facturation">
          <Grid>
            <Field label="Régime de TVA">
              <select name="taxMode" defaultValue={config.taxMode} className={inputClass}>
                <option value="FRANCHISE_293B">Franchise en base (art. 293 B du CGI)</option>
                <option value="STANDARD">TVA applicable</option>
              </select>
            </Field>
            <Field label="Taux de TVA (%)" hint="Utilisé uniquement si la TVA est applicable">
              <input name="taxRate" defaultValue={pct(config.taxRateBps)} className={inputClass} />
            </Field>
            <Field label="Préfixe des factures" hint="Verrouillé après la première facture">
              <input name="invoicePrefix" defaultValue={row?.invoicePrefix ?? "BTQ"} className={inputClass} />
            </Field>
          </Grid>
        </Card>

        <Card title="Fournisseurs">
          <Grid>
            <Field
              label="Taux USD → EUR (€ pour 1 $)"
              hint="Pour convertir les prix CJ (en dollars). À mettre à jour de temps en temps."
            >
              <input
                name="usdToEur"
                defaultValue={
                  row?.usdToEurMicros ? String(row.usdToEurMicros / 1_000_000).replace(".", ",") : ""
                }
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="aliexpressAutoPay"
                defaultChecked={row?.aliexpressAutoPay ?? true}
              />{" "}
              AliExpress : tenter le paiement automatique avec le moyen enregistré sur le compte (sinon :
              commande à payer à la main, signalée par email)
            </label>
          </Grid>
        </Card>

        <Card title="Seuils et alertes">
          <Grid>
            <Field
              label="Plafond micro-entreprise vente (€)"
              hint="Valeur officielle en vigueur, à vérifier chaque année"
            >
              <input
                name="microCeiling"
                defaultValue={centsToInput(row?.microRevenueCeilingCents)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Seuil de franchise de TVA (€)"
              hint="Valeur officielle en vigueur, à vérifier chaque année"
            >
              <input
                name="vatThreshold"
                defaultValue={centsToInput(row?.vatFranchiseThresholdCents)}
                className={inputClass}
              />
            </Field>
            <Field label="Alerter à partir de (% du seuil)">
              <input
                name="thresholdAlertRatio"
                defaultValue={pct(row?.thresholdAlertRatioBps ?? 8000)}
                className={inputClass}
              />
            </Field>
            <Field label="Alerte si marge sous (%)">
              <input
                name="marginAlert"
                defaultValue={pct(row?.marginAlertThresholdBps ?? 3000)}
                className={inputClass}
              />
            </Field>
            <Field label="Alerte stock bas du fournisseur principal (pièces)">
              <input
                name="lowStockThreshold"
                type="number"
                defaultValue={row?.lowStockThreshold ?? 10}
                className={inputClass}
              />
            </Field>
          </Grid>
        </Card>
      </ActionForm>
    </>
  );
}
