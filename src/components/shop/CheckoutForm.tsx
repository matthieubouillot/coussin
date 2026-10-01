"use client";

import { useActionState } from "react";
import Link from "next/link";
import { checkoutAction } from "@/app/(shop)/panier/checkout-action";

/**
 * Validation de commande. Le libellé du bouton et l'acceptation des CGV sont imposés par la loi
 * (art. L221-14 du Code de la consommation) ; l'acceptation est revérifiée côté serveur.
 */
export function CheckoutForm() {
  const [state, formAction, pending] = useActionState(checkoutAction, null);
  return (
    <form action={formAction} className="mt-8 space-y-4 rounded-2xl bg-white p-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="acceptCgv" required className="accent-cocoa mt-1 size-5" />
        <span>
          J&apos;ai lu et j&apos;accepte les{" "}
          <Link href="/cgv" className="underline" target="_blank">
            conditions générales de vente
          </Link>
          , y compris les informations sur le droit de rétractation.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-cocoa hover:bg-cocoa/90 min-h-12 w-full rounded-full px-6 py-3 font-medium text-white disabled:opacity-60"
      >
        Commander avec obligation de paiement
      </button>
      <p aria-live="polite" className="text-cocoa text-center text-sm">
        {state?.message}
      </p>
      <p className="text-ink/70 text-center text-xs">
        Vous serez redirigé vers la page de paiement sécurisée de Stripe (carte, Apple Pay, Google Pay).
      </p>
    </form>
  );
}
