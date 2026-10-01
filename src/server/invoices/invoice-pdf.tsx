import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CustomerSnapshot, InvoiceLine, SellerSnapshot } from "@/server/invoices/invoice-data";

/**
 * Rendu PDF d'une facture. Mentions obligatoires (art. 242 nonies A annexe II CGI, L441-9 C. com.) :
 * identité et SIRET du vendeur (avec la mention « EI »), numéro unique, date, identité du client,
 * désignation, quantité, prix unitaire, total, mention d'exonération de TVA, date de paiement.
 */

export type InvoicePdfData = {
  number: string;
  issuedAt: Date;
  orderNumber: string;
  paidAt: Date | null;
  paymentMethodType: string | null;
  seller: SellerSnapshot;
  customer: CustomerSnapshot;
  lines: InvoiceLine[];
  totalCents: number;
  taxCents: number;
  legalMention: string;
};

// Les polices PDF standard (Helvetica) ne contiennent pas l'espace fine insécable qu'utilise
// Intl en français : on formate à la main pour un rendu fiable.
export function pdfEuros(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${euros},${String(abs % 100).padStart(2, "0")} €`;
}

function pdfDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

const PAYMENT_LABELS: Record<string, string> = {
  card: "carte bancaire",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#2b2420" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  block: { marginTop: 18 },
  label: { fontFamily: "Helvetica-Bold", marginBottom: 3 },
  th: { fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderColor: "#6b4a35", paddingVertical: 4 },
  td: { paddingVertical: 4, borderBottomWidth: 0.5, borderColor: "#cccccc" },
  colLabel: { width: "52%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "19%", textAlign: "right" },
  colTotal: { width: "19%", textAlign: "right" },
  total: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 8 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#666666",
    textAlign: "center",
  },
});

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const { seller, customer } = data;
  return (
    <Document
      title={`Facture ${data.number}`}
      author={seller.sellerName}
      creationDate={data.issuedAt}
      producer=""
      creator=""
    >
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={s.title}>Facture</Text>
            <Text>N° {data.number}</Text>
            <Text>Date : {pdfDate(data.issuedAt)}</Text>
            <Text>Commande : {data.orderNumber}</Text>
          </View>
          <View style={{ maxWidth: 240 }}>
            <Text style={s.label}>{seller.shopName}</Text>
            <Text>{seller.sellerName} — EI</Text>
            <Text>{seller.legalStatus}</Text>
            <Text>{seller.address}</Text>
            <Text>SIRET : {seller.siret}</Text>
            <Text>{seller.email}</Text>
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.label}>Facturé et livré à</Text>
          <Text>{customer.name}</Text>
          {customer.addressLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
          <Text>{customer.email}</Text>
        </View>

        <View style={s.block}>
          <View style={[s.row, s.th]}>
            <Text style={s.colLabel}>Désignation</Text>
            <Text style={s.colQty}>Qté</Text>
            <Text style={s.colUnit}>Prix unitaire</Text>
            <Text style={s.colTotal}>Total</Text>
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={[s.row, s.td]}>
              <Text style={s.colLabel}>{line.label}</Text>
              <Text style={s.colQty}>{line.quantity}</Text>
              <Text style={s.colUnit}>{pdfEuros(line.unitPriceCents)}</Text>
              <Text style={s.colTotal}>{pdfEuros(line.totalCents)}</Text>
            </View>
          ))}
          <View style={[s.row, s.total]}>
            <Text>Total TTC</Text>
            <Text>{pdfEuros(data.totalCents)}</Text>
          </View>
          {data.taxCents > 0 && (
            <View style={s.row}>
              <Text>dont TVA</Text>
              <Text>{pdfEuros(data.taxCents)}</Text>
            </View>
          )}
        </View>

        <View style={s.block}>
          {data.legalMention && <Text>{data.legalMention}</Text>}
          {data.paidAt && (
            <Text>
              Facture acquittée le {pdfDate(data.paidAt)}
              {data.paymentMethodType
                ? ` par ${PAYMENT_LABELS[data.paymentMethodType] ?? data.paymentMethodType}`
                : ""}
              .
            </Text>
          )}
        </View>

        <Text style={s.footer} fixed>
          {seller.sellerName} — EI — SIRET {seller.siret} — {seller.address}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
