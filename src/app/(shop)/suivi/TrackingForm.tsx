"use client";

import { useActionState } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { trackOrderAction } from "./actions";

export function TrackingForm({ siteKey, nonce }: { siteKey: string; nonce?: string }) {
  const [state, formAction, pending] = useActionState(trackOrderAction, null);
  return (
    <>
      <form action={formAction} className="mt-6 space-y-4 rounded-2xl bg-white p-4">
        <label className="block text-sm font-medium">
          Numéro de commande
          <input
            name="orderNumber"
            required
            placeholder="C-XXXXXXXX"
            autoComplete="off"
            className="border-cocoa/30 mt-1 min-h-11 w-full rounded-lg border px-3 uppercase"
          />
        </label>
        <label className="block text-sm font-medium">
          Adresse email utilisée pour la commande
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="border-cocoa/30 mt-1 min-h-11 w-full rounded-lg border px-3"
          />
        </label>
        <Turnstile siteKey={siteKey} nonce={nonce} />
        <button
          type="submit"
          disabled={pending}
          className="bg-cocoa min-h-11 w-full rounded-full px-6 font-medium text-white disabled:opacity-60"
        >
          Voir ma commande
        </button>
      </form>
      <div aria-live="polite" className="mt-6">
        {state && !state.ok && <p className="text-cocoa">{state.message}</p>}
        {state?.ok && (
          <section className="rounded-2xl bg-white p-4">
            <h2 className="text-cocoa font-serif text-xl">Commande {state.orderNumber}</h2>
            <p className="mt-2">
              Statut : <strong>{state.statusLabel}</strong>
            </p>
            <ul className="mt-2 list-disc pl-5">
              {state.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {state.parcels.length > 0 && (
              <ul className="mt-3 space-y-1">
                {state.parcels.map((p) => (
                  <li key={p.trackingNumber}>
                    Colis {p.carrier ? `${p.carrier} ` : ""}n° {p.trackingNumber}
                    {p.trackingUrl && (
                      <>
                        {" — "}
                        <a
                          href={p.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          suivre le colis
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
