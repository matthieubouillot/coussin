import { ActionForm } from "@/components/admin/ActionForm";
import { buttonClass, Field, inputClass, secondaryButtonClass } from "@/components/admin/ui";
import type { SupplierOrderStatus } from "@/generated/prisma/client";
import { formatEuros } from "@/lib/money";
import {
  confirmPaymentAction,
  manualDeliveryAction,
  manualPlacementAction,
  manualTrackingAction,
  retryAfterCheckAction,
  switchToManualAction,
} from "@/app/admin/(protected)/commandes/[id]/supplier-actions";

export const SUPPLIER_STATUS_LABELS: Record<SupplierOrderStatus, string> = {
  QUEUED: "En file d'attente",
  PLACING: "Envoi en cours",
  NEEDS_CHECK: "À vérifier (résultat incertain)",
  MANUAL_ACTION_REQUIRED: "À passer manuellement",
  AWAITING_SUPPLIER_PAYMENT: "À payer chez le fournisseur",
  PLACED: "Commandée et payée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  FAILED: "Échec (bascule)",
  CANCELLED: "Annulée",
};

type Props = {
  so: {
    id: string;
    status: SupplierOrderStatus;
    adapter: string;
    externalOrderId: string | null;
    attempts: number;
    nextAttemptAt: Date | null;
    lastError: string | null;
    costCents: number | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    carrier: string | null;
    offer: {
      supplierName: string;
      externalUrl: string | null;
      purchaseCostCents: number;
      shippingCostCents: number;
    };
    items: { quantity: number; variantLabel: string }[];
  };
};

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Une commande fournisseur (= un colis) et les actions manuelles possibles selon son état. */
export function SupplierOrderPanel({ so }: Props) {
  const estimatedCost =
    (so.offer.purchaseCostCents + so.offer.shippingCostCents) * so.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="rounded-lg border border-stone-200 p-3 text-sm">
      <p>
        <strong>{SUPPLIER_STATUS_LABELS[so.status]}</strong> — {so.offer.supplierName} ({so.adapter}) —{" "}
        {so.items.map((i) => `${i.quantity} × ${i.variantLabel}`).join(", ")}
      </p>
      <p className="text-stone-600">
        {so.externalOrderId && <>Réf. fournisseur {so.externalOrderId} · </>}
        {so.costCents !== null && <>Coût {formatEuros(so.costCents)} · </>}
        {so.attempts} tentative(s)
        {so.nextAttemptAt && so.status === "QUEUED" && (
          <> · prochain essai {dateTime.format(so.nextAttemptAt)}</>
        )}
      </p>
      {so.trackingNumber && (
        <p>
          Suivi {so.carrier ?? ""} {so.trackingNumber}{" "}
          {so.trackingUrl && (
            <a href={so.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">
              voir
            </a>
          )}
        </p>
      )}
      {so.lastError && <p className="text-red-700">Dernière erreur : {so.lastError}</p>}

      <div className="mt-3 space-y-3">
        {so.status === "NEEDS_CHECK" && (
          <ActionForm
            action={retryAfterCheckAction}
            submitLabel="Renvoyer au fournisseur"
            submitClassName={secondaryButtonClass}
          >
            <input type="hidden" name="supplierOrderId" value={so.id} />
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm" /> J&apos;ai vérifié : aucune commande n&apos;existe chez
              le fournisseur.
            </label>
          </ActionForm>
        )}
        {(so.status === "QUEUED" || so.status === "NEEDS_CHECK") && (
          <ActionForm
            action={switchToManualAction}
            submitLabel="Passer en traitement manuel"
            submitClassName={secondaryButtonClass}
          >
            <input type="hidden" name="supplierOrderId" value={so.id} />
          </ActionForm>
        )}
        {(so.status === "MANUAL_ACTION_REQUIRED" || so.status === "NEEDS_CHECK") && (
          <div className="rounded-md bg-stone-50 p-3">
            {so.offer.externalUrl && (
              <a
                href={so.offer.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonClass} mb-3 inline-block`}
              >
                Passer chez le fournisseur ↗
              </a>
            )}
            <ActionForm
              action={manualPlacementAction}
              submitLabel="Enregistrer la commande fournisseur"
              submitClassName={secondaryButtonClass}
              className="grid gap-2 md:grid-cols-3"
            >
              <input type="hidden" name="supplierOrderId" value={so.id} />
              <Field label="Référence fournisseur">
                <input name="externalOrderId" required className={inputClass} />
              </Field>
              <Field label="Coût total payé (€)">
                <input
                  name="cost"
                  required
                  defaultValue={(estimatedCost / 100).toFixed(2).replace(".", ",")}
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="paid" defaultChecked /> Déjà payée
              </label>
            </ActionForm>
          </div>
        )}
        {so.status === "AWAITING_SUPPLIER_PAYMENT" && (
          <ActionForm
            action={confirmPaymentAction}
            submitLabel="J'ai payé cette commande fournisseur"
            submitClassName={secondaryButtonClass}
          >
            <input type="hidden" name="supplierOrderId" value={so.id} />
            <p className="text-stone-600">
              Le statut se met aussi à jour automatiquement (cron horaire) une fois payée sur AliExpress.
            </p>
          </ActionForm>
        )}
        {(so.status === "PLACED" || so.status === "AWAITING_SUPPLIER_PAYMENT") && (
          <ActionForm
            action={manualTrackingAction}
            submitLabel="Enregistrer le suivi et prévenir le client"
            submitClassName={secondaryButtonClass}
            className="grid gap-2 md:grid-cols-3"
          >
            <input type="hidden" name="supplierOrderId" value={so.id} />
            <Field label="Numéro de suivi">
              <input name="trackingNumber" required className={inputClass} />
            </Field>
            <Field label="Transporteur">
              <input name="carrier" placeholder="Colissimo, Mondial Relay…" className={inputClass} />
            </Field>
            <Field label="Lien de suivi (facultatif)">
              <input name="trackingUrl" className={inputClass} />
            </Field>
          </ActionForm>
        )}
        {so.status === "SHIPPED" && (
          <ActionForm
            action={manualDeliveryAction}
            submitLabel="Marquer comme livré"
            submitClassName={secondaryButtonClass}
          >
            <input type="hidden" name="supplierOrderId" value={so.id} />
          </ActionForm>
        )}
      </div>
    </div>
  );
}
