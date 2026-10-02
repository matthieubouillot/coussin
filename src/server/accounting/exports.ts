import "server-only";
import type { Period } from "@/lib/paris-time";
import { csvAmount, csvDate, csvText, toCsv } from "@/server/accounting/csv";
import { db } from "@/server/db";

const PAYMENT_LABELS: Record<string, string> = {
  card: "Carte bancaire",
  apple_pay: "Carte (Apple Pay)",
  google_pay: "Carte (Google Pay)",
};

/**
 * Livre des recettes (micro-entreprise, activité de vente) : chaque encaissement à sa date, chaque
 * remboursement en négatif à sa date, avec la pièce justificative (facture ou avoir).
 */
export async function salesLedgerCsv(period: Period): Promise<string> {
  const [orders, refunds] = await Promise.all([
    db.order.findMany({
      where: { paidAt: { gte: period.start, lt: period.end } },
      orderBy: { paidAt: "asc" },
      include: { invoices: { where: { type: "INVOICE" }, select: { number: true } } },
    }),
    db.refund.findMany({
      where: { status: "SUCCEEDED", refundedAt: { gte: period.start, lt: period.end } },
      orderBy: { refundedAt: "asc" },
      include: {
        creditNote: { select: { number: true } },
        order: { select: { shippingName: true, number: true, paymentMethodType: true } },
      },
    }),
  ]);

  type Row = { at: Date; cells: string[] };
  const rows: Row[] = [
    ...orders.map((o) => ({
      at: o.paidAt!,
      cells: [
        csvDate(o.paidAt),
        csvDate(o.payoutAt),
        csvText(o.invoices[0]?.number ?? "SANS FACTURE — à régulariser"),
        csvText(o.shippingName),
        csvText(`Vente — commande ${o.number}`),
        csvAmount(o.totalCents),
        csvText(PAYMENT_LABELS[o.paymentMethodType ?? ""] ?? o.paymentMethodType ?? ""),
      ],
    })),
    ...refunds.map((r) => ({
      at: r.refundedAt!,
      cells: [
        csvDate(r.refundedAt),
        "",
        csvText(r.creditNote?.number ?? ""),
        csvText(r.order.shippingName),
        csvText(`Remboursement — commande ${r.order.number}`),
        csvAmount(-r.amountCents),
        csvText(PAYMENT_LABELS[r.order.paymentMethodType ?? ""] ?? r.order.paymentMethodType ?? ""),
      ],
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const total = orders.reduce((s, o) => s + o.totalCents, 0) - refunds.reduce((s, r) => s + r.amountCents, 0);
  return toCsv(
    [
      "Date d'encaissement",
      "Date de virement Stripe",
      "Pièce",
      "Client",
      "Nature",
      "Montant (€)",
      "Mode de paiement",
    ],
    [...rows.map((r) => r.cells), ["", "", "", "", csvText("TOTAL DE LA PÉRIODE"), csvAmount(total), ""]],
  );
}

/** Registre des achats (obligatoire pour l'activité de vente de marchandises). */
export async function purchaseRegisterCsv(period: Period): Promise<string> {
  const purchases = await db.purchaseRecord.findMany({
    where: { date: { gte: period.start, lt: period.end } },
    orderBy: { date: "asc" },
  });
  const total = purchases.reduce((s, p) => s + p.amountCents, 0);
  return toCsv(
    ["Date", "Fournisseur", "Référence", "Désignation", "Montant (€)", "Mode de paiement"],
    [
      ...purchases.map((p) => [
        csvDate(p.date),
        csvText(p.supplierName),
        csvText(p.reference),
        csvText(p.description),
        csvAmount(p.amountCents),
        csvText(p.paymentMethod),
      ]),
      ["", "", "", csvText("TOTAL DE LA PÉRIODE"), csvAmount(total), ""],
    ],
  );
}
