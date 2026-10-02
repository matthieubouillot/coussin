import { describe, expect, it } from "vitest";
import { productJsonLd, serializeJsonLd, type JsonLdInput } from "@/server/seo/product-jsonld";

const base: JsonLdInput = {
  url: "https://boutique.test/",
  name: "Coussin auto-chauffant",
  description: "Au chaud sans électricité.",
  brand: null,
  productGroupId: "coussin-auto-chauffant",
  images: [],
  variants: [
    {
      sku: "COUSSIN-M",
      label: "M — 60 × 48 cm",
      sizeName: "M",
      priceCents: 2990,
      available: true,
      deliveryDaysMin: 7,
      deliveryDaysMax: 12,
    },
    {
      sku: "COUSSIN-L",
      label: "L — 60 × 90 cm",
      sizeName: "L",
      priceCents: 4990,
      available: false,
      deliveryDaysMin: null,
      deliveryDaysMax: null,
    },
  ],
  shipping: { priceCents: 490, freeAboveCents: 4900 },
  reviews: [],
};

describe("données structurées produit", () => {
  it("une offre par taille, prix et disponibilité réels", () => {
    const data = productJsonLd(base) as { hasVariant: { offers: { price: string; availability: string } }[] };
    expect(data.hasVariant.map((v) => [v.offers.price, v.offers.availability])).toEqual([
      ["29.90", "https://schema.org/InStock"],
      ["49.90", "https://schema.org/OutOfStock"],
    ]);
  });

  it("aucune note moyenne sans avis réels", () => {
    expect(productJsonLd(base).aggregateRating).toBeUndefined();
    expect(productJsonLd(base).review).toBeUndefined();
  });

  it("note moyenne calculée sur les avis publiés", () => {
    const data = productJsonLd({
      ...base,
      reviews: [
        { author: "Camille M.", rating: 5, body: "Parfait", date: new Date("2026-11-02") },
        { author: "Lucas B.", rating: 4, body: "Bien", date: null },
      ],
    });
    expect(data.aggregateRating).toMatchObject({ ratingValue: "4.5", reviewCount: 2 });
  });

  it("politique de retour : 14 jours, frais à la charge du client (décision Q8)", () => {
    const data = productJsonLd(base) as {
      hasVariant: { offers: { hasMerchantReturnPolicy: Record<string, unknown> } }[];
    };
    expect(data.hasVariant[0]!.offers.hasMerchantReturnPolicy).toMatchObject({
      merchantReturnDays: 14,
      returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    });
  });

  it("sérialisation qui ne peut pas fermer la balise script", () => {
    expect(serializeJsonLd({ text: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
