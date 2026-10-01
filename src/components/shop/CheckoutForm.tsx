import Link from "next/link";

/**
 * Validation de commande. Le libellé du bouton et la case CGV sont imposés par la loi
 * (art. L221-14 du Code de la consommation). Le paiement Stripe est branché en phase 3 :
 * d'ici là, le bouton est visible mais désactivé.
 */
export function CheckoutForm() {
  return (
    <form className="mt-8 space-y-4 rounded-2xl bg-white p-4">
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
        disabled
        className="bg-cocoa min-h-12 w-full rounded-full px-6 py-3 font-medium text-white disabled:opacity-60"
      >
        Commander avec obligation de paiement
      </button>
      <p className="text-ink/70 text-center text-sm">Paiement en ligne bientôt disponible.</p>
    </form>
  );
}
