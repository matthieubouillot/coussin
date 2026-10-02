import type { MetadataRoute } from "next";

// Le chemin admin n'est volontairement pas listé ici (ce fichier est public) :
// il est protégé par X-Robots-Tag, l'authentification et son caractère secret.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/panier", "/commande/", "/suivi", "/avis/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
