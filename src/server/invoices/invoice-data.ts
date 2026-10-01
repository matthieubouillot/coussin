import { z } from "zod";

/** Contenu figé d'une facture (snapshots JSON stockés sur la ligne Invoice). */

export const invoiceLineSchema = z.object({
  label: z.string(),
  quantity: z.int(),
  unitPriceCents: z.int(),
  totalCents: z.int(),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const sellerSnapshotSchema = z.object({
  shopName: z.string(),
  sellerName: z.string(),
  legalStatus: z.string(),
  siret: z.string(),
  address: z.string(),
  email: z.string(),
});
export type SellerSnapshot = z.infer<typeof sellerSnapshotSchema>;

export const customerSnapshotSchema = z.object({
  name: z.string(),
  email: z.string(),
  addressLines: z.array(z.string()),
});
export type CustomerSnapshot = z.infer<typeof customerSnapshotSchema>;

export const VAT_EXEMPT_MENTION = "TVA non applicable, art. 293 B du CGI";

/** Numéro formaté : BTQ-000042 (factures) ou BTQ-AV-000007 (avoirs). */
export function formatInvoiceNumber(series: string, n: number): string {
  return `${series}-${String(n).padStart(6, "0")}`;
}

type OrderForInvoice = {
  items: { productName: string; variantLabel: string; quantity: number; unitPriceCents: number }[];
  bundleDiscountCents: number;
  promoDiscountCents: number;
  promoCode: string | null;
  shippingCents: number;
};

/** Lignes de facture : articles, remises (négatives), livraison. La somme égale le total payé. */
export function buildInvoiceLines(order: OrderForInvoice): InvoiceLine[] {
  const lines: InvoiceLine[] = order.items.map((i) => ({
    label: `${i.productName} — taille ${i.variantLabel}`,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    totalCents: i.unitPriceCents * i.quantity,
  }));
  if (order.bundleDiscountCents > 0) {
    lines.push({
      label: "Remise offre par lot",
      quantity: 1,
      unitPriceCents: -order.bundleDiscountCents,
      totalCents: -order.bundleDiscountCents,
    });
  }
  if (order.promoDiscountCents > 0) {
    const label = order.promoCode ? `Code promo ${order.promoCode}` : "Code promo";
    lines.push({
      label,
      quantity: 1,
      unitPriceCents: -order.promoDiscountCents,
      totalCents: -order.promoDiscountCents,
    });
  }
  lines.push({
    label: "Livraison France métropolitaine",
    quantity: 1,
    unitPriceCents: order.shippingCents,
    totalCents: order.shippingCents,
  });
  return lines;
}
