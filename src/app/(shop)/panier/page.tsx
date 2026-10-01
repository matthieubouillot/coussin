import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { PromoCodeForm } from "@/components/shop/PromoCodeForm";
import { formatEuros } from "@/lib/money";
import { getCartView } from "@/server/cart/cart";
import { getActiveShippingRate } from "@/server/catalog/catalog";
import { removePromoAction, updateQuantityAction } from "./actions";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default async function CartPage() {
  const [cart, shipping] = await Promise.all([getCartView(), getActiveShippingRate()]);
  const { totals } = cart;

  if (cart.lines.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-cocoa font-serif text-3xl">Votre panier</h1>
        {cart.removedCount > 0 && (
          <p role="status" className="mt-4 rounded-xl bg-white p-3">
            Un article de votre panier n&apos;est plus disponible et a été retiré.
          </p>
        )}
        <p className="mt-4">Votre panier est vide.</p>
        <Link href="/" className="bg-cocoa mt-6 inline-block rounded-full px-6 py-3 font-medium text-white">
          Découvrir le coussin
        </Link>
      </main>
    );
  }

  const remainingForFreeShipping =
    shipping?.freeAboveCents != null && totals.shippingCents > 0
      ? shipping.freeAboveCents -
        (totals.subtotalCents - (totals.bundle?.discountCents ?? 0) - (totals.promo?.discountCents ?? 0))
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-cocoa font-serif text-3xl">Votre panier</h1>

      {cart.removedCount > 0 && (
        <p role="status" className="mt-4 rounded-xl bg-white p-3">
          Un article de votre panier n&apos;est plus disponible et a été retiré.
        </p>
      )}

      <ul className="divide-cocoa/10 mt-6 divide-y rounded-2xl bg-white">
        {cart.lines.map((line) => (
          <li
            key={line.variantId}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{line.productName}</p>
              <p className="text-ink/80 text-sm">Taille {line.label}</p>
              <p className="text-ink/80 text-sm">{formatEuros(line.unitPriceCents)} l&apos;unité</p>
            </div>
            <div className="flex items-center gap-3">
              <form action={updateQuantityAction} className="flex items-center gap-2">
                <input type="hidden" name="variantId" value={line.variantId} />
                <label className="text-sm">
                  <span className="sr-only">Quantité pour la taille {line.label}</span>
                  <select
                    name="quantity"
                    defaultValue={line.quantity}
                    className="border-cocoa/30 min-h-11 rounded-lg border bg-white px-3"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="border-cocoa/30 min-h-11 rounded-lg border px-3 text-sm">
                  Mettre à jour
                </button>
              </form>
              <form action={updateQuantityAction}>
                <input type="hidden" name="variantId" value={line.variantId} />
                <input type="hidden" name="quantity" value="0" />
                <button type="submit" className="min-h-11 px-2 text-sm underline">
                  Retirer<span className="sr-only"> la taille {line.label}</span>
                </button>
              </form>
              <p className="w-24 text-right font-medium">{formatEuros(line.lineTotalCents)}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          {cart.promoCodeEntered && totals.promo ? (
            <form
              action={removePromoAction}
              className="flex items-center justify-between rounded-xl bg-white p-3 text-sm"
            >
              <span>
                Code <strong>{totals.promo.code}</strong> appliqué
              </span>
              <button type="submit" className="underline">
                Retirer
              </button>
            </form>
          ) : (
            <>
              <PromoCodeForm />
              {cart.promoCodeEntered && totals.promoRejection === "MIN_SUBTOTAL" && (
                <p className="text-cocoa mt-2 text-sm">
                  Le code {cart.promoCodeEntered} nécessite un montant d&apos;achat minimum non atteint.
                </p>
              )}
            </>
          )}
        </div>

        <dl className="space-y-2 rounded-2xl bg-white p-4">
          <div className="flex justify-between">
            <dt>Sous-total</dt>
            <dd>{formatEuros(totals.subtotalCents)}</dd>
          </div>
          {totals.bundle && (
            <div className="text-sage flex justify-between">
              <dt>{totals.bundle.name}</dt>
              <dd>−{formatEuros(totals.bundle.discountCents)}</dd>
            </div>
          )}
          {totals.promo && (
            <div className="text-sage flex justify-between">
              <dt>Code {totals.promo.code}</dt>
              <dd>−{formatEuros(totals.promo.discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Livraison (France métropolitaine)</dt>
            <dd>{totals.shippingCents === 0 ? "Offerte" : formatEuros(totals.shippingCents)}</dd>
          </div>
          {remainingForFreeShipping !== null && remainingForFreeShipping > 0 && (
            <p className="text-ink/80 text-sm">
              Plus que {formatEuros(remainingForFreeShipping)} pour la livraison offerte.
            </p>
          )}
          <div className="border-cocoa/10 flex justify-between border-t pt-2 text-lg font-medium">
            <dt>Total TTC</dt>
            <dd>{formatEuros(totals.totalCents)}</dd>
          </div>
          {totals.taxCents > 0 && (
            <p className="text-ink/80 text-sm">dont TVA : {formatEuros(totals.taxCents)}</p>
          )}
        </dl>
      </div>

      <CheckoutForm />
    </main>
  );
}
