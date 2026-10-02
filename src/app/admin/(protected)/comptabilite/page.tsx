import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { buttonClass, Card, Field, inputClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { formatEuros } from "@/lib/money";
import { parisDateParts } from "@/lib/paris-time";
import { thresholdStatus } from "@/server/admin/thresholds";
import { adminHref } from "@/server/auth/admin-path";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { addPurchaseAction } from "./actions";

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });

export default async function AccountingPage() {
  await requireAdmin();
  const { year } = parisDateParts();
  const [thresholds, purchases] = await Promise.all([
    thresholdStatus(),
    db.purchaseRecord.findMany({ orderBy: { date: "desc" }, take: 20 }),
  ]);

  return (
    <>
      <PageTitle>Comptabilité</PageTitle>

      <Card title="Exports CSV">
        <form method="get" action="/api/admin/exports" className="flex flex-wrap items-end gap-3">
          <Field label="Registre">
            <select name="registre" className={inputClass}>
              <option value="recettes">Livre des recettes</option>
              <option value="achats">Registre des achats</option>
            </select>
          </Field>
          <Field label="Année">
            <input
              name="annee"
              type="number"
              defaultValue={year}
              min={2020}
              max={2100}
              className={inputClass}
            />
          </Field>
          <Field label="Période">
            <select name="periode" className={inputClass}>
              <option value="mois">Mois</option>
              <option value="trimestre">Trimestre</option>
              <option value="annee">Année entière</option>
            </select>
          </Field>
          <Field label="N° (mois 1-12 ou trimestre 1-4)">
            <input
              name="index"
              type="number"
              min={1}
              max={12}
              defaultValue={parisDateParts().month}
              className={inputClass}
            />
          </Field>
          <button type="submit" className={buttonClass}>
            Télécharger le CSV
          </button>
        </form>
        <p className="mt-3 text-xs text-stone-500">
          Recettes : date d&apos;encaissement = date du paiement par le client ; remboursements en négatif à
          leur date. À reporter dans la déclaration URSSAF de l&apos;activité de vente (BIC).
        </p>
      </Card>

      <Card title="Seuils de l'année civile">
        {thresholds.length === 0 ? (
          <p className="text-sm">
            Aucun seuil saisi —{" "}
            <Link href={adminHref("/reglages")} className="underline">
              les renseigner
            </Link>
            .
          </p>
        ) : (
          <ul className="text-sm">
            {thresholds.map((t) => (
              <li key={t.label}>
                {t.label} : {formatEuros(t.currentCents)} / {formatEuros(t.limitCents)} ({t.percent} %)
                {t.alert && <strong className="ml-2 text-amber-700">alerte</strong>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Ajouter un achat au registre">
        <ActionForm
          action={addPurchaseAction}
          submitLabel="Ajouter"
          submitClassName={secondaryButtonClass}
          className="grid gap-3 md:grid-cols-3"
        >
          <Field label="Date">
            <input name="date" type="date" required className={inputClass} />
          </Field>
          <Field label="Fournisseur">
            <input name="supplierName" required className={inputClass} />
          </Field>
          <Field label="Référence (n° de commande fournisseur)">
            <input name="reference" required className={inputClass} />
          </Field>
          <Field label="Désignation">
            <input name="description" required className={inputClass} />
          </Field>
          <Field label="Montant TTC payé (€)">
            <input name="amount" required className={inputClass} />
          </Field>
          <Field label="Mode de paiement">
            <input name="paymentMethod" required defaultValue="Carte bancaire" className={inputClass} />
          </Field>
        </ActionForm>
        {purchases.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {purchases.map((p) => (
              <li key={p.id}>
                {date.format(p.date)} — {p.supplierName} — {p.reference} — {p.description} —{" "}
                {formatEuros(p.amountCents)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
