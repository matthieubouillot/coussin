import { cookies } from "next/headers";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { MarketingProvider } from "@/components/marketing/MarketingProvider";
import { Footer } from "@/components/shop/Footer";
import { Header } from "@/components/shop/Header";
import { CONSENT_COOKIE_NAME, hasConsent } from "@/lib/consent";
import { parseConsentCookie } from "@/lib/consent-schema";
import { env } from "@/server/env";
import { activeDestinations } from "@/server/marketing/destinations";
import { getShopConfig } from "@/server/settings/settings";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const [config, destinations] = await Promise.all([getShopConfig(), activeDestinations()]);
  // Bandeau cookies sur la boutique uniquement : l'admin n'utilise que des cookies indispensables.
  const consent = parseConsentCookie((await cookies()).get(CONSENT_COOKIE_NAME)?.value);
  const adsConsent = hasConsent(consent, "ads");
  return (
    <MarketingProvider
      adsConsent={adsConsent}
      tiktokPixelId={destinations.tiktok ? (env().TIKTOK_PIXEL_ID ?? null) : null}
      metaPixelId={destinations.meta ? (env().META_PIXEL_ID ?? null) : null}
    >
      <div className="flex min-h-dvh flex-col">
        {/* Bandeau saisonnier activable dans l'admin : jamais de faux compte à rebours ni de fausse urgence. */}
        {config.christmasBanner && (
          <p className="bg-sage px-4 py-2 text-center text-sm font-medium text-white">
            {config.christmasBanner}
          </p>
        )}
        <Header shopName={config.shopName} />
        <div className="flex-1">{children}</div>
        <Footer shopName={config.shopName} vatExempt={config.taxMode === "FRANCHISE_293B"} />
        <CookieConsent initialConsent={consent} />
      </div>
    </MarketingProvider>
  );
}
