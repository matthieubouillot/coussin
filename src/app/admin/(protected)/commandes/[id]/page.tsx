import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  buttonClass,
  Card,
  dangerButtonClass,
  Field,
  inputClass,
  Notice,
  PageTitle,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { formatEuros } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { refundableCents } from "@/server/orders/refunds";
import { SupplierOrderPanel } from "@/components/admin/SupplierOrderPanel";
import { addNoteAction, cancelAction, refundAction, updateWithdrawalAction } from "./actions";
import { relaunchAction } from "./supplier-actions";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const WITHDRAWAL_LABELS = {
  RECEIVED: "Reçue",
  ACCEPTED: "Acceptée — retour attendu",
  RETURN_RECEIVED: "Retour reçu",
  REFUNDED: "Remboursée",
  REJECTED: "Refusée",
} as const;

export default async function OrderDetailPage({ params }: PageProps<"/admin/commandes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      statusEvents: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { issuedAt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" } },
      withdrawals: { orderBy: { createdAt: "asc" } },
      supplierOrders: {
        orderBy: { createdAt: "asc" },
        include: {
          offer: {
            select: {
              supplierName: true,
              externalUrl: true,
              purchaseCostCents: true,
              shippingCostCents: true,
            },
          },
          items: { select: { quantity: true, variantLabel: true } },
        },
      },
      promoCode: { select: { code: true } },
    },
  });
  if (!order) notFound();

  const remaining = order.paidAt ? await refundableCents(order.id) : 0;
  const canCancel = ["PENDING_PAYMENT", "PAID", "FULFILLMENT_ERROR", "SENT_TO_SUPPLIER"].includes(
    order.status,
  );
  const mismatch = order.notes.some((n) => n.authorId === "system" && n.body.startsWith("ÉCART DE MONTANT"));

  return (
    <>
      <PageTitle>
        Commande {order.number} — {ORDER_STATUS_LABELS[order.status]}
      </PageTitle>

      {mismatch && (
        <Notice tone="danger">
          Écart entre le montant encaissé par Stripe et le total de la commande : vérifier avant toute
          expédition.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Client et livraison">
          <p className="text-sm">
            {order.shippingName ?? "—"}
            <br />
            {order.shippingLine1}
            {order.shippingLine2 && (
              <>
                <br />
                {order.shippingLine2}
              </>
            )}
            <br />
            {order.shippingPostalCode} {order.shippingCity} ({order.shippingCountry})
            <br />
            {order.email} · {order.phone ?? "pas de téléphone"}
          </p>
          {(order.utmSource || order.utmCampaign) && (
            <p className="mt-2 text-xs text-stone-500">
              Provenance :{" "}
              {[order.utmSource, order.utmMedium, order.utmCampaign, order.utmContent]
                .filter(Boolean)
                .join(" / ")}
            </p>
          )}
        </Card>

        <Card title="Articles et montants">
          <table className="w-full text-sm">
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td className="py-1">
                    {i.quantity} × {i.productName} — {i.variantLabel}{" "}
                    <span className="text-stone-500">({i.sku})</span>
                  </td>
                  <td className="py-1 text-right">{formatEuros(i.unitPriceCents * i.quantity)}</td>
                </tr>
              ))}
              {order.bundleDiscountCents > 0 && (
                <tr>
                  <td>Remise lot</td>
                  <td className="text-right">−{formatEuros(order.bundleDiscountCents)}</td>
                </tr>
              )}
              {order.promoDiscountCents > 0 && (
                <tr>
                  <td>Code {order.promoCode?.code}</td>
                  <td className="text-right">−{formatEuros(order.promoDiscountCents)}</td>
                </tr>
              )}
              <tr>
                <td>Livraison</td>
                <td className="text-right">{formatEuros(order.shippingCents)}</td>
              </tr>
              <tr className="font-medium">
                <td>Total</td>
                <td className="text-right">{formatEuros(order.totalCents)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-stone-500">
            Payée le {order.paidAt ? dateTime.format(order.paidAt) : "—"} ·{" "}
            {order.paymentMethodType ?? "moyen inconnu"} · Stripe {order.stripePaymentIntentId ?? "—"}
          </p>
        </Card>
      </div>

      <Card title="Factures et avoirs">
        {order.invoices.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun document émis.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {order.invoices.map((inv) => (
              <li key={inv.id}>
                <a href={`/api/admin/documents/${inv.id}`} className="underline">
                  {inv.type === "CREDIT_NOTE" ? "Avoir" : "Facture"} {inv.number}
                </a>{" "}
                — {formatEuros(inv.totalCents)} — {dateTime.format(inv.issuedAt)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {order.status !== "PENDING_PAYMENT" && (
        <Card title="Fournisseurs et colis">
          {order.supplierOrders.length === 0 ? (
            <p className="text-sm text-stone-500">Pas encore transmise au fournisseur.</p>
          ) : (
            <div className="space-y-3">
              {order.supplierOrders.map((so) => (
                <SupplierOrderPanel key={so.id} so={so} />
              ))}
            </div>
          )}
          {["PAID", "FULFILLMENT_ERROR", "SENT_TO_SUPPLIER"].includes(order.status) && (
            <div className="mt-3">
              <ActionForm
                action={relaunchAction}
                submitLabel="Relancer le traitement automatique"
                submitClassName={secondaryButtonClass}
              >
                <input type="hidden" name="orderId" value={order.id} />
              </ActionForm>
            </div>
          )}
        </Card>
      )}

      {order.withdrawals.length > 0 && (
        <Card title="Demandes de rétractation">
          <ul className="space-y-3 text-sm">
            {order.withdrawals.map((w) => (
              <li key={w.id}>
                {dateTime.format(w.createdAt)} — {WITHDRAWAL_LABELS[w.status]}
                {w.message && <p className="text-stone-600">« {w.message} »</p>}
                <form action={updateWithdrawalAction} className="mt-1 flex gap-2">
                  <input type="hidden" name="id" value={w.id} />
                  <select
                    name="status"
                    className="rounded border border-stone-300 px-2 py-1"
                    defaultValue={w.status}
                  >
                    <option value="ACCEPTED">Acceptée — retour attendu</option>
                    <option value="RETURN_RECEIVED">Retour reçu</option>
                    <option value="REJECTED">Refusée (hors délai)</option>
                  </select>
                  <button type="submit" className={secondaryButtonClass}>
                    Mettre à jour
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500">
            Rappel : rembourser au plus tard 14 jours après la demande (possible d&apos;attendre le retour ou
            la preuve d&apos;expédition).
          </p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {remaining > 0 && (
          <Card title={`Rembourser (restant : ${formatEuros(remaining)})`}>
            <ActionForm
              action={refundAction}
              submitLabel="Rembourser via Stripe"
              submitClassName={buttonClass}
            >
              <input type="hidden" name="orderId" value={order.id} />
              <Field label="Montant (€)">
                <input
                  name="amount"
                  required
                  defaultValue={(remaining / 100).toFixed(2).replace(".", ",")}
                  className={inputClass}
                />
              </Field>
              <Field label="Motif (figure sur l'avoir)">
                <input
                  name="reason"
                  required
                  maxLength={200}
                  placeholder="Rétractation, produit défectueux…"
                  className={inputClass}
                />
              </Field>
            </ActionForm>
          </Card>
        )}

        {canCancel && (
          <Card title="Annuler la commande">
            <ActionForm
              action={cancelAction}
              submitLabel="Annuler la commande"
              submitClassName={dangerButtonClass}
            >
              <input type="hidden" name="orderId" value={order.id} />
              <Field label="Motif">
                <input name="reason" required maxLength={200} className={inputClass} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" /> Je confirme : la commande sera annulée et, si elle a
                été payée, intégralement remboursée.
              </label>
            </ActionForm>
          </Card>
        )}
      </div>

      {order.refunds.length > 0 && (
        <Card title="Remboursements">
          <ul className="space-y-1 text-sm">
            {order.refunds.map((r) => (
              <li key={r.id}>
                {dateTime.format(r.createdAt)} — {formatEuros(r.amountCents)} — {r.status} — {r.reason}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Historique des statuts">
          <ol className="space-y-1 text-sm">
            {order.statusEvents.map((e) => (
              <li key={e.id}>
                {dateTime.format(e.createdAt)} —{" "}
                {e.fromStatus ? `${ORDER_STATUS_LABELS[e.fromStatus]} → ` : ""}
                <strong>{ORDER_STATUS_LABELS[e.toStatus]}</strong> ({e.actorType}) — {e.reason}
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Notes internes">
          <ActionForm
            action={addNoteAction}
            submitLabel="Ajouter la note"
            submitClassName={secondaryButtonClass}
          >
            <input type="hidden" name="orderId" value={order.id} />
            <textarea
              name="body"
              required
              maxLength={2000}
              rows={2}
              className={inputClass}
              aria-label="Nouvelle note"
            />
          </ActionForm>
          <ul className="mt-3 space-y-2 text-sm">
            {order.notes.map((n) => (
              <li key={n.id} className="rounded bg-stone-50 p-2">
                <span className="text-xs text-stone-500">{dateTime.format(n.createdAt)}</span>
                <p className="whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
