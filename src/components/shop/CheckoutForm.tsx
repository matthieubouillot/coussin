"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { checkoutAction } from "@/app/(shop)/panier/checkout-action";
import { useMarketing } from "@/components/marketing/MarketingProvider";
import { ATTRIBUTION_PARAMS, newEventId, type MarketingEvent } from "@/lib/marketing/events";

/**
 * Validation de commande. Le libellé du bouton et l'acceptation des CGV sont imposés par la loi
 * (art. L221-14 du Code de la consommation) ; l'acceptation est revérifiée côté serveur.
 * La provenance de la visite (UTM) et l'identifiant d'événement partent avec le formulaire.
 */
export function CheckoutForm({ cart }: { cart: Pick<MarketingEvent, "valueCents" | "contents"> }) {
  const [state, formAction, pending] = useActionState(checkoutAction, null);
  const { track, attribution } = useMarketing();
  const form = useRef<HTMLFormElement>(null);

  // Champs cachés remplis dès l'affichage : ils font ainsi partie du formulaire envoyé.
  useEffect(() => {
    const f = form.current;
    if (!f) return;
    (f.elements.namedItem("marketingEventId") as HTMLInputElement).value = newEventId();
    const current = attribution();
    for (const key of ATTRIBUTION_PARAMS)
      (f.elements.namedItem(key) as HTMLInputElement).value = current[key] ?? "";
  }, [attribution]);

  function onSubmit() {
    const eventId = (form.current?.elements.namedItem("marketingEventId") as HTMLInputElement | null)?.value;
    if (eventId) track({ name: "InitiateCheckout", eventId, ...cart });
  }

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={onSubmit}
      className="mt-8 space-y-4 rounded-2xl bg-white p-4"
    >
      <input type="hidden" name="marketingEventId" defaultValue="" />
      {ATTRIBUTION_PARAMS.map((key) => (
        <input key={key} type="hidden" name={key} defaultValue="" />
      ))}
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
