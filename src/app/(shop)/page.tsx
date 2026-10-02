import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { TrackEvent } from "@/components/marketing/TrackEvent";
import { BuyBox, type BuyBoxVariant } from "@/components/shop/BuyBox";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { deliveryWindow } from "@/server/catalog/availability";
import {
  getActiveBundles,
  getActiveShippingRate,
  getApprovedReviews,
  getMainProduct,
} from "@/server/catalog/catalog";
import { describeBundle } from "@/server/catalog/describe-bundle";
import { productJsonLd, serializeJsonLd } from "@/server/seo/product-jsonld";
import { isPlaceholder } from "@/server/settings/legal-identity";
import { getShopConfig } from "@/server/settings/settings";
import { env } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  const [product, config] = await Promise.all([getMainProduct(), getShopConfig()]);
  if (!product) return { title: config.shopName };
  const minPrice = Math.min(...product.variants.map((v) => v.priceCents));
  const description = `${product.tagline} Coussin auto-chauffant sans électricité pour chats et chiens, dès ${(minPrice / 100).toFixed(2).replace(".", ",")} €. Livraison suivie en France, retour 14 jours.`;
  const image = product.media.find((m) => m.kind === "IMAGE");
  return {
    title: { absolute: `${product.name} | ${config.shopName}` },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: config.shopName,
      title: product.name,
      description,
      url: "/",
      // Sans photo produit, l'image générée par opengraph-image.tsx est utilisée.
      ...(image
        ? { images: [{ url: image.blobUrl, width: image.width, height: image.height, alt: image.alt }] }
        : {}),
    },
    twitter: { card: "summary_large_image", title: product.name, description },
  };
}

// Page d'accueil = page produit (boutique « one-product »).
export default async function ProductPage() {
  const [product, config, bundles] = await Promise.all([
    getMainProduct(),
    getShopConfig(),
    getActiveBundles(),
  ]);

  if (!product) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-24">
        <h1 className="text-cocoa font-serif text-4xl">Boutique en préparation</h1>
        <p className="text-lg">Notre coussin auto-chauffant arrive très bientôt.</p>
      </main>
    );
  }

  const [reviews, shippingRate, nonce] = await Promise.all([
    getApprovedReviews(product.id),
    getActiveShippingRate(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);
  const jsonLd = productJsonLd({
    url: `${env().NEXT_PUBLIC_SITE_URL}/`,
    name: product.name,
    description: product.tagline,
    brand: isPlaceholder(config.shopName) ? null : config.shopName,
    productGroupId: product.slug,
    images: product.media.filter((m) => m.kind === "IMAGE").map((m) => m.blobUrl),
    variants: product.variants.map((v) => ({
      sku: v.sku,
      label: v.label,
      sizeName: v.label.split(" ")[0] ?? v.label,
      priceCents: v.priceCents,
      available: v.availability.available,
      deliveryDaysMin: v.availability.available ? v.availability.deliveryDaysMin : null,
      deliveryDaysMax: v.availability.available ? v.availability.deliveryDaysMax : null,
    })),
    shipping: shippingRate,
    reviews: reviews.map((r) => ({
      author: r.displayName,
      rating: r.rating,
      body: r.body,
      date: r.publishedAt,
    })),
  });
  const labels = new Map(product.variants.map((v) => [v.id, v.label.split(" ")[0] ?? v.label]));
  const bundleTexts = bundles.map((b) => describeBundle(b, labels)).filter((t): t is string => t !== null);

  const buyBoxVariants: BuyBoxVariant[] = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    productName: product.name,
    label: v.label,
    recommendedFor: v.recommendedFor,
    priceCents: v.priceCents,
    referencePriceCents: v.referencePriceCents,
    available: v.availability.available,
    deliveryLabel: v.availability.available ? deliveryWindow(v.availability).label : null,
  }));

  const { content, sizeGuide, gpsr } = product;
  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <TrackEvent
        event={{
          name: "ViewContent",
          valueCents: product.variants[0]?.priceCents ?? 0,
          contents: product.variants.map((v) => ({
            id: v.sku,
            name: `${product.name} — ${v.label}`,
            quantity: 1,
            priceCents: v.priceCents,
          })),
        }}
      />
      <section className="grid gap-8 lg:grid-cols-2 lg:gap-12" aria-labelledby="product-title">
        <ProductGallery media={product.media} productName={product.name} />
        <div className="space-y-6">
          <div>
            <h1 id="product-title" className="text-cocoa font-serif text-3xl sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-2 text-lg">{product.tagline}</p>
            {averageRating !== null && (
              <p className="mt-2 text-sm">
                <a href="#avis" className="underline underline-offset-2">
                  {averageRating.toFixed(1).replace(".", ",")} / 5 — {reviews.length} avis vérifié
                  {reviews.length > 1 ? "s" : ""}
                </a>
              </p>
            )}
          </div>

          <BuyBox
            variants={buyBoxVariants}
            bundleTexts={bundleTexts}
            vatExempt={config.taxMode === "FRANCHISE_293B"}
          />

          {sizeGuide && (
            <details className="rounded-xl bg-white p-4">
              <summary className="cursor-pointer font-medium">Guide des tailles</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Correspondance entre tailles et animaux</caption>
                  <thead>
                    <tr className="border-cocoa/20 border-b">
                      <th scope="col" className="py-2 pr-3">
                        Taille
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        Dimensions
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        Pour
                      </th>
                      <th scope="col" className="py-2">
                        Poids conseillé
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizeGuide.rows.map((row) => (
                      <tr key={row.size} className="border-cocoa/10 border-b">
                        <th scope="row" className="py-2 pr-3 font-medium">
                          {row.size}
                        </th>
                        <td className="py-2 pr-3">{row.dimensions}</td>
                        <td className="py-2 pr-3">{row.animal}</td>
                        <td className="py-2">{row.weight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sizeGuide.note && <p className="text-ink/80 mt-2 text-sm">{sizeGuide.note}</p>}
              </div>
            </details>
          )}

          <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <li className="rounded-xl bg-white p-3">Paiement sécurisé (carte, Apple Pay, Google Pay)</li>
            <li className="rounded-xl bg-white p-3">Droit de rétractation de 14 jours</li>
            <li className="rounded-xl bg-white p-3">Garantie légale de conformité de 2 ans</li>
            <li className="rounded-xl bg-white p-3">Suivi de colis par email</li>
          </ul>
        </div>
      </section>

      {content && (
        <>
          <section className="mt-16 max-w-3xl" aria-labelledby="how">
            <h2 id="how" className="text-cocoa font-serif text-2xl">
              {content.howItWorks.title}
            </h2>
            {content.howItWorks.paragraphs.map((p) => (
              <p key={p} className="mt-3 leading-relaxed">
                {p}
              </p>
            ))}
          </section>

          <section className="mt-12" aria-labelledby="benefits">
            <h2 id="benefits" className="text-cocoa font-serif text-2xl">
              Les bénéfices
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {content.benefits.map((b) => (
                <li key={b.title} className="rounded-2xl bg-white p-5">
                  <h3 className="font-medium">{b.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed">{b.text}</p>
                </li>
              ))}
            </ul>
          </section>

          {content.care.length > 0 && (
            <section className="mt-12 max-w-3xl" aria-labelledby="care">
              <h2 id="care" className="text-cocoa font-serif text-2xl">
                Entretien et lavage
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {content.care.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="mt-12 max-w-3xl" aria-labelledby="specs">
        <h2 id="specs" className="text-cocoa font-serif text-2xl">
          Caractéristiques
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          {product.variants.map((v) => (
            <div key={v.id} className="contents">
              <dt className="font-medium">Dimensions {v.label.split(" ")[0]}</dt>
              <dd>
                {v.widthCm} × {v.lengthCm} cm
              </dd>
            </div>
          ))}
          <dt className="font-medium">Composition</dt>
          <dd>{product.textileComposition ?? "Information en cours de vérification auprès du fabricant."}</dd>
          <dt className="font-medium">Contenu du colis</dt>
          <dd>{product.packageContents}</dd>
          {product.careInstructions && (
            <>
              <dt className="font-medium">Consignes d&apos;entretien</dt>
              <dd>{product.careInstructions}</dd>
            </>
          )}
          {product.sortingInstructions && (
            <>
              <dt className="font-medium">Consignes de tri</dt>
              <dd>{product.sortingInstructions}</dd>
            </>
          )}
        </dl>
      </section>

      {content && content.faq.length > 0 && (
        <section className="mt-12 max-w-3xl" aria-labelledby="faq">
          <h2 id="faq" className="text-cocoa font-serif text-2xl">
            Questions fréquentes
          </h2>
          <div className="mt-3 space-y-2">
            {content.faq.map((item) => (
              <details key={item.question} className="rounded-xl bg-white p-4">
                <summary className="cursor-pointer font-medium">{item.question}</summary>
                <p className="mt-2 leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {content && content.guarantees.length > 0 && (
        <section className="mt-12" aria-labelledby="guarantees">
          <h2 id="guarantees" className="text-cocoa font-serif text-2xl">
            Nos engagements
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {content.guarantees.map((g) => (
              <li key={g.title} className="rounded-2xl bg-white p-5">
                <h3 className="font-medium">{g.title}</h3>
                <p className="mt-1 text-sm leading-relaxed">{g.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="avis" className="mt-12 max-w-3xl scroll-mt-8" aria-labelledby="reviews">
        <h2 id="reviews" className="text-cocoa font-serif text-2xl">
          Avis clients
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-3">
            Aucun avis pour le moment. Seuls les clients ayant réellement acheté et reçu le coussin peuvent en
            déposer un.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white p-5">
                <p className="font-medium">
                  <span aria-label={`${r.rating} sur 5`}>
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </span>{" "}
                  {r.displayName}
                </p>
                <p className="mt-2 leading-relaxed">{r.body}</p>
                <p className="text-ink/70 mt-2 text-xs">Achat vérifié</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <Link href="/avis-clients" className="underline underline-offset-2">
            Comment les avis sont collectés et contrôlés
          </Link>
        </p>
      </section>

      <section className="mt-12 max-w-3xl text-sm" aria-labelledby="safety">
        <h2 id="safety" className="text-cocoa font-serif text-xl">
          Sécurité du produit et fabricant
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-medium">Fabricant</dt>
          <dd>
            {gpsr.manufacturerName
              ? [gpsr.manufacturerName, gpsr.manufacturerAddress, gpsr.manufacturerContact]
                  .filter(Boolean)
                  .join(" — ")
              : "Information en cours de vérification."}
          </dd>
          <dt className="font-medium">Personne responsable dans l&apos;UE</dt>
          <dd>
            {gpsr.euResponsibleName
              ? [gpsr.euResponsibleName, gpsr.euResponsibleAddress, gpsr.euResponsibleContact]
                  .filter(Boolean)
                  .join(" — ")
              : "Information en cours de vérification."}
          </dd>
          {gpsr.productReference && (
            <>
              <dt className="font-medium">Référence</dt>
              <dd>{gpsr.productReference}</dd>
            </>
          )}
          {gpsr.safetyWarnings && (
            <>
              <dt className="font-medium">Avertissements</dt>
              <dd className="whitespace-pre-line">{gpsr.safetyWarnings}</dd>
            </>
          )}
        </dl>
      </section>
    </main>
  );
}
