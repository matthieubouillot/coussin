import { describe, expect, it } from "vitest";
import { buildInvoiceLines, formatInvoiceNumber } from "@/server/invoices/invoice-data";
import { pdfEuros } from "@/server/invoices/invoice-pdf";
import { generateOrderNumber } from "@/server/orders/order-number";

describe("factures", () => {
  it("numérotation sur 6 chiffres par série", () => {
    expect(formatInvoiceNumber("BTQ", 42)).toBe("BTQ-000042");
    expect(formatInvoiceNumber("BTQ-AV", 7)).toBe("BTQ-AV-000007");
  });

  it("la somme des lignes égale le total payé (remises négatives, livraison)", () => {
    const lines = buildInvoiceLines({
      items: [
        { productName: "Coussin", variantLabel: "M", quantity: 2, unitPriceCents: 2990 },
        { productName: "Coussin", variantLabel: "L", quantity: 1, unitPriceCents: 4490 },
      ],
      bundleDiscountCents: 1047,
      promoDiscountCents: 500,
      promoCode: "NOEL",
      shippingCents: 0,
    });
    expect(lines.map((l) => l.label)).toEqual([
      "Coussin — taille M",
      "Coussin — taille L",
      "Remise offre par lot",
      "Code promo NOEL",
      "Livraison France métropolitaine",
    ]);
    expect(lines.reduce((s, l) => s + l.totalCents, 0)).toBe(5980 + 4490 - 1047 - 500);
  });

  it("formate les montants pour le PDF sans caractère exotique", () => {
    expect(pdfEuros(2990)).toBe("29,90 €");
    expect(pdfEuros(123456)).toBe("1 234,56 €");
    expect(pdfEuros(-500)).toBe("-5,00 €");
  });
});

describe("numéro de commande", () => {
  it("format C- + 8 caractères non ambigus", () => {
    for (let i = 0; i < 200; i++) expect(generateOrderNumber()).toMatch(/^C-[23456789A-HJ-KM-NP-Z]{8}$/);
  });
});
