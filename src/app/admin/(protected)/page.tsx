import Link from "next/link";
import { Card, Notice, PageTitle } from "@/components/admin/ui";
import { formatEuros } from "@/lib/money";
import { periodOf } from "@/lib/paris-time";
import { cashedRevenue, estimatedGrossMargin } from "@/server/admin/revenue";
import { thresholdStatus } from "@/server/admin/thresholds";
import { adminHref } from "@/server/auth/admin-path";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";

export default async function AdminDashboard() {
  await requireAdmin();
  const [day, month, year, margin, errors, awaitingPayment, returns, thresholds] = await Promise.all([
    cashedRevenue(periodOf("day")),
    cashedRevenue(periodOf("month")),
    cashedRevenue(periodOf("year")),
    estimatedGrossMargin(periodOf("month")),
    db.order.count({ where: { status: "FULFILLMENT_ERROR" } }),
    db.supplierOrder.count({ where: { status: "AWAITING_SUPPLIER_PAYMENT" } }),
    db.withdrawalRequest.count({ where: { status: { in: ["RECEIVED", "ACCEPTED", "RETURN_RECEIVED"] } } }),
    thresholdStatus(),
  ]);

  const averageBasket = month.orders > 0 ? Math.round(month.grossCents / month.orders) : 0;

  return (
    <>
      <PageTitle>Tableau de bord</PageTitle>

      {awaitingPayment > 0 && (
        <Notice tone="warning">
          <strong>{awaitingPayment} commande(s) fournisseur à payer</strong> sur AliExpress.{" "}
          <Link href={adminHref("/commandes?statut=a-payer")} className="underline">
            Voir
          </Link>
        </Notice>
      )}
      {errors > 0 && (
        <Notice tone="danger">
          <strong>{errors} commande(s) en erreur de traitement.</strong>{" "}
          <Link href={adminHref("/commandes?statut=FULFILLMENT_ERROR")} className="underline">
            Voir
          </Link>
        </Notice>
      )}
      {thresholds.map((t) =>
        t.alert ? (
          <Notice key={t.label} tone="warning">
            {t.label} : {formatEuros(t.currentCents)} encaissés cette année, soit {t.percent} % du seuil de{" "}
            {formatEuros(t.limitCents)}.
          </Notice>
        ) : null,
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Encaissé aujourd'hui" value={formatEuros(day.netCents)} />
        <Stat
          label="Encaissé ce mois"
          value={formatEuros(month.netCents)}
          detail={`${month.orders} commande(s)`}
        />
        <Stat
          label="Encaissé cette année"
          value={formatEuros(year.netCents)}
          detail={`${year.orders} commande(s)`}
        />
        <Stat label="Panier moyen (mois)" value={formatEuros(averageBasket)} />
        <Stat
          label="Marge brute estimée (mois)"
          value={formatEuros(margin)}
          detail="Encaissé − coût des articles, hors frais Stripe"
        />
        <Stat label="Commandes en erreur" value={String(errors)} />
        <Stat label="Retours en cours" value={String(returns)} />
        <Stat label="Remboursé ce mois" value={formatEuros(month.refundsCents)} />
      </div>

      <Card title="Seuils de la micro-entreprise (année civile)">
        {thresholds.length === 0 ? (
          <p className="text-sm">
            Aucun seuil saisi.{" "}
            <Link href={adminHref("/reglages")} className="underline">
              Renseigner les seuils dans les réglages
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {thresholds.map((t) => (
              <li key={t.label}>
                {t.label} : {formatEuros(t.currentCents)} / {formatEuros(t.limitCents)} ({t.percent} %)
                <div className="mt-1 h-2 rounded bg-stone-200">
                  <div
                    className={`h-2 rounded ${t.alert ? "bg-amber-500" : "bg-sage"}`}
                    style={{ width: `${Math.min(t.percent, 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
      {detail && <p className="mt-1 text-xs text-stone-500">{detail}</p>}
    </div>
  );
}
