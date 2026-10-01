import Link from "next/link";
import { getCartView } from "@/server/cart/cart";

export async function Header({ shopName }: { shopName: string }) {
  const cart = await getCartView();
  return (
    <header className="border-cocoa/10 bg-cream/95 border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-cocoa font-serif text-xl">
          {shopName}
        </Link>
        <Link
          href="/panier"
          className="border-cocoa/30 rounded-full border px-4 py-2 text-sm font-medium hover:bg-white"
          aria-label={`Panier, ${cart.itemCount} article${cart.itemCount > 1 ? "s" : ""}`}
        >
          Panier ({cart.itemCount})
        </Link>
      </div>
    </header>
  );
}
