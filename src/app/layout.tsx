import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/lib/consent";
import "./globals.css";

// next/font auto-héberge les polices au build : aucune requête vers Google côté visiteur (RGPD, CSP).
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "[À COMPLÉTER : nom de la boutique]",
  description: "Coussin auto-chauffant pour chats et chiens, sans électricité.",
};

export const viewport: Viewport = {
  themeColor: "#f7f3ec",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Lire les cookies rend toutes les pages dynamiques : indispensable pour que chaque
  // réponse reçoive le nonce CSP de sa requête.
  const consent = parseConsentCookie((await cookies()).get(CONSENT_COOKIE_NAME)?.value);

  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-cream text-ink font-sans antialiased">
        {children}
        <CookieConsent initialConsent={consent} />
      </body>
    </html>
  );
}
