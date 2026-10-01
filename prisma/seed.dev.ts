/**
 * Données de DÉVELOPPEMENT uniquement.
 *
 * Les textes produit décrivent le produit réel tel que présenté par le fournisseur.
 * Tous les chiffres non confirmés (prix L, coûts, délais) sont FICTIFS et marqués comme tels :
 * ils seront saisis par Matthieu dans l'admin. Ce script refuse de tourner en production.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PLACEHOLDER_LEGAL_IDENTITY } from "../src/server/settings/legal-identity";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("seed.dev.ts : refusé en production (aucune donnée de démonstration en ligne).");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const content = {
  howItWorks: {
    title: "Comment ça chauffe sans électricité ?",
    paragraphs: [
      "Une fine couche réfléchissante est placée à l'intérieur du coussin. Quand votre animal s'y installe, elle lui renvoie la chaleur que son propre corps dégage, au lieu de la laisser se perdre dans le sol.",
      "Résultat : un couchage qui devient chaud au contact de votre animal, sans prise, sans pile, sans batterie. La chaleur reste naturelle, celle de son corps : elle ne peut pas dépasser sa propre température.",
    ],
  },
  benefits: [
    {
      title: "Aucun câble",
      text: "Rien à mordiller, rien à brancher : idéal pour les chiots et les chats joueurs.",
    },
    {
      title: "Aucune surchauffe",
      text: "La chaleur vient de votre animal lui-même : pas de risque de brûlure.",
    },
    {
      title: "Zéro consommation",
      text: "Aucune électricité, aucune facture : il fonctionne tout l'hiver gratuitement.",
    },
    { title: "Lavable en machine", text: "La housse douce se retire grâce à sa fermeture éclair." },
  ],
  care: [
    "Retirez la housse grâce à la fermeture éclair avant lavage.",
    "Lavez la housse en machine à basse température (consigne exacte à confirmer avec le fabricant).",
    "Ne lavez pas la couche réfléchissante intérieure en machine.",
  ],
  faq: [
    {
      question: "Le coussin chauffe-t-il tout seul, sans animal dessus ?",
      answer:
        "Non. Il ne produit pas de chaleur : il renvoie celle de votre animal. Il devient chaud quand votre animal s'y couche.",
    },
    {
      question: "Quelle taille choisir ?",
      answer:
        "La taille M (60 × 48 cm) convient aux chats et aux petits chiens, la taille L (60 × 90 cm) aux chiens moyens. Consultez le guide des tailles.",
    },
    {
      question: "D'où le coussin est-il expédié ?",
      answer:
        "Il est expédié directement par notre fournisseur. Le délai estimé est affiché avant l'achat, et vous recevez un numéro de suivi par email.",
    },
  ],
  guarantees: [
    { title: "14 jours pour changer d'avis", text: "Droit de rétractation de 14 jours à réception." },
    {
      title: "Garantie légale de 2 ans",
      text: "En cas de défaut, réparation, remplacement ou remboursement.",
    },
    { title: "Paiement sécurisé", text: "Par Stripe : nous n'avons jamais accès à vos données bancaires." },
  ],
};

const sizeGuide = {
  rows: [
    { size: "M", dimensions: "60 × 48 cm", animal: "Chats, petits chiens", weight: "[FICTIF] jusqu'à 8 kg" },
    { size: "L", dimensions: "60 × 90 cm", animal: "Chiens moyens", weight: "[FICTIF] 8 à 20 kg" },
  ],
  note: "En cas d'hésitation, choisissez la taille au-dessus : votre animal doit pouvoir s'allonger entièrement.",
};

async function main() {
  await db.shopSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      shopName: "[À COMPLÉTER : nom de la boutique]",
      legalIdentity: PLACEHOLDER_LEGAL_IDENTITY,
      cgvVersion: "2026-10-01",
      christmasBannerText:
        "Une idée cadeau douce pour Noël : un coussin qui garde votre animal au chaud tout l'hiver.",
    },
  });

  const product = await db.product.upsert({
    where: { slug: "coussin-auto-chauffant" },
    update: { contentBlocks: content, sizeGuide },
    create: {
      slug: "coussin-auto-chauffant",
      name: "Coussin auto-chauffant pour chats et chiens",
      tagline: "Votre animal au chaud tout l'hiver, sans électricité.",
      contentBlocks: content,
      sizeGuide,
      packageContents: "1 coussin avec sa housse amovible.",
      defaultAdapter: "ALIEXPRESS",
      active: true,
    },
  });

  const variants = [
    {
      sku: "COUSSIN-M",
      label: "M — 60 × 48 cm",
      widthCm: 60,
      lengthCm: 48,
      recommendedFor: "Chats et petits chiens",
      priceCents: 2990,
      position: 1,
    },
    // [FICTIF] Prix L à définir par Matthieu dans l'admin.
    {
      sku: "COUSSIN-L",
      label: "L — 60 × 90 cm",
      widthCm: 60,
      lengthCm: 90,
      recommendedFor: "Chiens moyens",
      priceCents: 4490,
      position: 2,
    },
  ];

  for (const v of variants) {
    const variant = await db.variant.upsert({
      where: { sku: v.sku },
      update: {},
      create: { ...v, productId: product.id },
    });
    if ((await db.salePriceHistory.count({ where: { variantId: variant.id } })) === 0) {
      await db.salePriceHistory.create({ data: { variantId: variant.id, priceCents: v.priceCents } });
    }
    if ((await db.supplierOffer.count({ where: { variantId: variant.id } })) === 0) {
      await db.supplierOffer.create({
        data: {
          variantId: variant.id,
          adapter: "ALIEXPRESS",
          supplierName: "AliExpress",
          externalProductId: "1005010155230759",
          priority: 1,
          // [FICTIF] sauf le coût M (≈ 5,79 € annoncé) ; port et délais à vérifier.
          purchaseCostCents: v.sku === "COUSSIN-M" ? 579 : 999,
          shippingCostCents: 0,
          deliveryDaysMin: 7,
          deliveryDaysMax: 12,
        },
      });
    }
  }

  if ((await db.shippingRate.count()) === 0) {
    await db.shippingRate.create({
      data: { name: "Livraison standard suivie", priceCents: 490, freeAboveCents: 4900 },
    });
  }

  if ((await db.bundleOffer.count()) === 0) {
    const ids = await db.variant.findMany({ where: { productId: product.id }, orderBy: { position: "asc" } });
    // Offres validées en phase 0, créées désactivées.
    await db.bundleOffer.createMany({
      data: [
        {
          name: "Lot de 2 coussins",
          kind: "QUANTITY",
          minQuantity: 2,
          discountType: "PERCENT",
          discountValue: 1000,
        },
        {
          name: "Duo M + L",
          kind: "COMBO",
          comboVariantIds: ids.map((v) => v.id),
          discountType: "FIXED",
          discountValue: 500,
        },
      ],
    });
  }

  console.warn("Seed de développement appliqué.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
