import { cookies } from "next/headers";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { Footer } from "@/components/shop/Footer";
import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/lib/consent";
import { Header } from "@/components/shop/Header";
import { getShopConfig } from "@/server/settings/settings";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const config = await getShopConfig();
  // Bandeau cookies sur la boutique uniquement : l'admin n'utilise que des cookies indispensables.
  const consent = parseConsentCookie((await cookies()).get(CONSENT_COOKIE_NAME)?.value);
  return (
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
  );
}
