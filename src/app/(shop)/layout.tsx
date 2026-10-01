import { Footer } from "@/components/shop/Footer";
import { Header } from "@/components/shop/Header";
import { getShopConfig } from "@/server/settings/settings";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const config = await getShopConfig();
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
    </div>
  );
}
