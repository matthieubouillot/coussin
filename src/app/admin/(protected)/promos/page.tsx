import { ActionForm } from "@/components/admin/ActionForm";
import { Card, Field, inputClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { centsToInput, dateToInput } from "@/server/admin/form-helpers";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { savePromoAction } from "./actions";

export default async function PromosPage() {
  await requireAdmin();
  const promos = await db.promoCode.findMany({ orderBy: { code: "asc" } });
  return (
    <>
      <PageTitle>Codes promo</PageTitle>
      {[...promos, null].map((p) => (
        <Card
          key={p?.id ?? "new"}
          title={
            p
              ? `${p.code} — utilisé ${p.usedCount}${p.maxUses ? ` / ${p.maxUses}` : ""} fois`
              : "Nouveau code"
          }
        >
          <ActionForm
            action={savePromoAction}
            submitLabel="Enregistrer"
            submitClassName={secondaryButtonClass}
            className="grid gap-3 md:grid-cols-4"
          >
            {p && <input type="hidden" name="promoId" value={p.id} />}
            <Field label="Code">
              <input name="code" defaultValue={p?.code} required className={`${inputClass} uppercase`} />
            </Field>
            <Field label="Type">
              <select name="discountType" defaultValue={p?.discountType ?? "PERCENT"} className={inputClass}>
                <option value="PERCENT">Pourcentage</option>
                <option value="FIXED">Montant fixe (€)</option>
              </select>
            </Field>
            <Field label="Valeur (% ou €)">
              <input
                name="value"
                required
                defaultValue={
                  p
                    ? p.discountType === "PERCENT"
                      ? String(p.discountValue / 100).replace(".", ",")
                      : centsToInput(p.discountValue)
                    : ""
                }
                className={inputClass}
              />
            </Field>
            <Field label="Minimum d'achat (€, facultatif)">
              <input
                name="minSubtotal"
                defaultValue={centsToInput(p?.minSubtotalCents)}
                className={inputClass}
              />
            </Field>
            <Field label="Utilisations max (facultatif)">
              <input
                name="maxUses"
                type="number"
                min={1}
                defaultValue={p?.maxUses ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="Début (facultatif)">
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={dateToInput(p?.startsAt ?? null)}
                className={inputClass}
              />
            </Field>
            <Field label="Expiration (facultatif)">
              <input
                name="expiresAt"
                type="datetime-local"
                defaultValue={dateToInput(p?.expiresAt ?? null)}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> Actif
            </label>
          </ActionForm>
        </Card>
      ))}
    </>
  );
}
