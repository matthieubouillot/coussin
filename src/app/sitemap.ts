import type { MetadataRoute } from "next";
import { db } from "@/server/db";

// Pages publiques indexables. Panier, commande, suivi, avis et admin en sont volontairement exclus.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const product = await db.product.findFirst({ where: { active: true }, select: { updatedAt: true } });
  const legal = [
    "/cgv",
    "/mentions-legales",
    "/confidentialite",
    "/cookies",
    "/avis-clients",
    "/contact",
    "/retractation",
  ];
  return [
    {
      url: `${site}/`,
      lastModified: product?.updatedAt ?? new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...legal.map((path) => ({ url: `${site}${path}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
