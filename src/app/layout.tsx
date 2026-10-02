import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Fraunces } from "next/font/google";
import { getShopConfig } from "@/server/settings/settings";
import "./globals.css";

// next/font auto-héberge les polices au build : aucune requête vers Google côté visiteur (RGPD, CSP).
// Une seule police web, pour les titres ; le texte courant utilise la police système de l'appareil
// (affichage immédiat, meilleur LCP sur mobile).
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { shopName } = await getShopConfig();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: shopName, template: `%s | ${shopName}` },
    description: "Coussin auto-chauffant pour chats et chiens, sans électricité.",
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#f7f3ec",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Lire les en-têtes rend toutes les pages dynamiques : indispensable pour que chaque
  // réponse reçoive le nonce CSP de sa requête.
  await headers();

  return (
    <html lang="fr" className={serif.variable}>
      <body className="bg-cream text-ink font-sans antialiased">{children}</body>
    </html>
  );
}
