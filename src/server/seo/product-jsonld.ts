/**
 * Données structurées schema.org de la page produit (fonction pure, testée).
 * ProductGroup + une variante par taille, chacune avec son Offer. La note moyenne
 * (AggregateRating) n'apparaît QUE s'il existe de vrais avis publiés.
 */

export type JsonLdInput = {
  url: string;
  name: string;
  description: string;
  brand: string | null;
  productGroupId: string;
  images: string[];
  variants: {
    sku: string;
    label: string;
    sizeName: string;
    priceCents: number;
    available: boolean;
    deliveryDaysMin: number | null;
    deliveryDaysMax: number | null;
  }[];
  shipping: { priceCents: number; freeAboveCents: number | null } | null;
  reviews: { author: string; rating: number; body: string; date: Date | null }[];
};

const euros = (cents: number) => (cents / 100).toFixed(2);

export function productJsonLd(input: JsonLdInput): Record<string, unknown> {
  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "FR",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 14,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
  };

  const variants = input.variants.map((v) => ({
    "@type": "Product",
    sku: v.sku,
    name: `${input.name} — taille ${v.label}`,
    size: v.sizeName,
    image: input.images.length ? input.images : undefined,
    offers: {
      "@type": "Offer",
      url: input.url,
      priceCurrency: "EUR",
      price: euros(v.priceCents),
      itemCondition: "https://schema.org/NewCondition",
      availability: v.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      hasMerchantReturnPolicy: returnPolicy,
      shippingDetails:
        input.shipping && v.deliveryDaysMax !== null
          ? {
              "@type": "OfferShippingDetails",
              shippingDestination: { "@type": "DefinedRegion", addressCountry: "FR" },
              shippingRate: {
                "@type": "MonetaryAmount",
                currency: "EUR",
                value: euros(
                  input.shipping.freeAboveCents !== null && v.priceCents >= input.shipping.freeAboveCents
                    ? 0
                    : input.shipping.priceCents,
                ),
              },
              deliveryTime: {
                "@type": "ShippingDeliveryTime",
                handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 2, unitCode: "DAY" },
                transitTime: {
                  "@type": "QuantitativeValue",
                  minValue: v.deliveryDaysMin ?? 0,
                  maxValue: v.deliveryDaysMax,
                  unitCode: "DAY",
                },
              },
            }
          : undefined,
    },
  }));

  const rated = input.reviews.filter((r) => r.rating >= 1 && r.rating <= 5);
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: input.name,
    description: input.description,
    url: input.url,
    productGroupID: input.productGroupId,
    brand: input.brand ? { "@type": "Brand", name: input.brand } : undefined,
    image: input.images.length ? input.images : undefined,
    variesBy: ["https://schema.org/size"],
    hasVariant: variants,
    aggregateRating:
      rated.length > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1),
            reviewCount: rated.length,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    review:
      rated.length > 0
        ? rated.slice(0, 10).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            reviewBody: r.body,
            datePublished: r.date?.toISOString().slice(0, 10),
          }))
        : undefined,
  };
}

/** Sérialisation sûre dans une balise <script> : « < » échappé, impossible de fermer la balise. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
