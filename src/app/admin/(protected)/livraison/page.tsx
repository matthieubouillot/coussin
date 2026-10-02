import { ActionForm } from "@/components/admin/ActionForm";
import { Card, Field, inputClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { centsToInput, dateToInput } from "@/server/admin/form-helpers";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { saveBundleAction, saveShippingRateAction } from "./actions";

export default async function ShippingAndBundlesPage() {
  await requireAdmin();
  const [rates, bundles, variants] = await Promise.all([
    db.shippingRate.findMany({ orderBy: { priceCents: "asc" } }),
    db.bundleOffer.findMany({ orderBy: { name: "asc" } }),
    db.variant.findMany({ orderBy: { position: "asc" }, select: { id: true, label: true } }),
  ]);

  return (
    <>
      <PageTitle>Livraison et offres par lot</PageTitle>
      <h2 className="mb-3 font-medium">Tarifs de livraison (France métropolitaine)</h2>
      <p className="mb-3 text-sm text-stone-600">
        Le tarif actif le moins cher est appliqué. Le seuil de gratuité s&apos;apprécie après remises.
      </p>
      {[...rates, null].map((r) => (
        <Card key={r?.id ?? "new"} title={r ? r.name : "Nouveau tarif"}>
          <ActionForm
            action={saveShippingRateAction}
            submitLabel="Enregistrer"
            submitClassName={secondaryButtonClass}
            className="grid gap-3 md:grid-cols-4"
          >
            {r && <input type="hidden" name="rateId" value={r.id} />}
            <Field label="Nom affiché">
              <input
                name="name"
                required
                defaultValue={r?.name ?? "Livraison standard suivie"}
                className={inputClass}
              />
            </Field>
            <Field label="Prix (€)">
              <input
                name="price"
                required
                defaultValue={centsToInput(r?.priceCents ?? null)}
                className={inputClass}
              />
            </Field>
            <Field label="Offerte dès (€, facultatif)">
              <input name="freeAbove" defaultValue={centsToInput(r?.freeAboveCents)} className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={r?.active ?? true} /> Actif
            </label>
          </ActionForm>
        </Card>
      ))}

      <h2 className="mt-8 mb-3 font-medium">Offres par lot</h2>
      <p className="mb-3 text-sm text-stone-600">
        Une seule offre s&apos;applique par panier : la plus avantageuse pour le client.
      </p>
      {[...bundles, null].map((b) => (
        <Card
          key={b?.id ?? "new"}
          title={b ? `${b.name}${b.active ? "" : " (désactivée)"}` : "Nouvelle offre"}
        >
          <ActionForm
            action={saveBundleAction}
            submitLabel="Enregistrer"
            submitClassName={secondaryButtonClass}
            className="grid gap-3 md:grid-cols-4"
          >
            {b && <input type="hidden" name="bundleId" value={b.id} />}
            <Field label="Nom (affiché au panier)">
              <input name="name" required defaultValue={b?.name} className={inputClass} />
            </Field>
            <Field label="Type">
              <select name="kind" defaultValue={b?.kind ?? "QUANTITY"} className={inputClass}>
                <option value="QUANTITY">À partir de N coussins</option>
                <option value="COMBO">Combinaison de tailles</option>
              </select>
            </Field>
            <Field label="Quantité minimum (lot par quantité)">
              <input
                name="minQuantity"
                type="number"
                min={2}
                defaultValue={b?.minQuantity ?? ""}
                className={inputClass}
              />
            </Field>
            <fieldset className="text-sm">
              <legend className="font-medium">Tailles du combo</legend>
              {variants.map((v) => (
                <label key={v.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="comboVariantIds"
                    value={v.id}
                    defaultChecked={b?.comboVariantIds.includes(v.id)}
                  />{" "}
                  {v.label}
                </label>
              ))}
            </fieldset>
            <Field label="Type de remise">
              <select name="discountType" defaultValue={b?.discountType ?? "PERCENT"} className={inputClass}>
                <option value="PERCENT">Pourcentage</option>
                <option value="FIXED">Montant fixe (€)</option>
              </select>
            </Field>
            <Field label="Valeur (% ou €)">
              <input
                name="value"
                required
                defaultValue={
                  b
                    ? b.discountType === "PERCENT"
                      ? String(b.discountValue / 100).replace(".", ",")
                      : centsToInput(b.discountValue)
                    : ""
                }
                className={inputClass}
              />
            </Field>
            <Field label="Début (facultatif)">
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={dateToInput(b?.startsAt ?? null)}
                className={inputClass}
              />
            </Field>
            <Field label="Fin (facultatif)">
              <input
                name="endsAt"
                type="datetime-local"
                defaultValue={dateToInput(b?.endsAt ?? null)}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={b?.active ?? false} /> Active
            </label>
          </ActionForm>
        </Card>
      ))}
    </>
  );
}
