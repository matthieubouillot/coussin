"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { addToCartAction } from "@/app/(shop)/panier/actions";
import { formatEuros } from "@/lib/money";

export type BuyBoxVariant = {
  id: string;
  label: string;
  recommendedFor: string;
  priceCents: number;
  referencePriceCents: number | null;
  available: boolean;
  /** Fenêtre de livraison déjà calculée côté serveur à partir du fournisseur réellement utilisé. */
  deliveryLabel: string | null;
};

export function BuyBox({
  variants,
  bundleTexts,
  vatExempt,
}: {
  variants: BuyBoxVariant[];
  bundleTexts: string[];
  vatExempt: boolean;
}) {
  const firstAvailable = variants.find((v) => v.available) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id);
  const [state, formAction, pending] = useActionState(addToCartAction, null);
  const groupId = useId();
  const selected = variants.find((v) => v.id === selectedId);

  if (!selected) return null;

  return (
    <form action={formAction} className="space-y-5">
      <div aria-live="polite">
        <p className="flex items-baseline gap-3">
          <span className="text-cocoa font-serif text-3xl">{formatEuros(selected.priceCents)}</span>
          {selected.referencePriceCents !== null && (
            <span className="text-ink/70">
              <span className="sr-only">Prix de référence : </span>
              <s>{formatEuros(selected.referencePriceCents)}</s>
              <span className="ml-1 text-xs">(prix le plus bas des 30 derniers jours)</span>
            </span>
          )}
        </p>
        <p className="text-ink/70 text-sm">
          Prix TTC{vatExempt ? " — TVA non applicable, art. 293 B du CGI" : ""}
        </p>
      </div>

      <fieldset>
        <legend id={groupId} className="mb-2 font-medium">
          Taille
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {variants.map((v) => (
            <label
              key={v.id}
              className={`has-[:focus-visible]:ring-sage flex cursor-pointer flex-col rounded-xl border-2 p-3 has-[:focus-visible]:ring-2 ${
                v.id === selectedId ? "border-cocoa bg-white" : "border-cocoa/20"
              } ${v.available ? "" : "cursor-not-allowed opacity-60"}`}
            >
              <input
                type="radio"
                name="variantId"
                value={v.id}
                checked={v.id === selectedId}
                disabled={!v.available}
                onChange={() => setSelectedId(v.id)}
                className="sr-only"
              />
              <span className="font-medium">{v.label}</span>
              <span className="text-ink/80 text-sm">{v.recommendedFor}</span>
              {!v.available && <span className="text-cocoa mt-1 text-sm font-medium">En rupture</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-end gap-3">
        <label className="flex flex-col text-sm font-medium">
          Quantité
          <select
            name="quantity"
            defaultValue="1"
            className="border-cocoa/30 mt-1 min-h-11 rounded-lg border bg-white px-3"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || !selected.available}
          className="bg-cocoa hover:bg-cocoa/90 min-h-11 flex-1 rounded-full px-6 py-3 font-medium text-white disabled:opacity-60"
        >
          {selected.available ? "Ajouter au panier" : "Indisponible"}
        </button>
      </div>

      <p aria-live="polite" className="min-h-6 text-sm">
        {state && (
          <span className={state.ok ? "text-sage" : "text-cocoa"}>
            {state.message}{" "}
            {state.ok && (
              <Link href="/panier" className="font-medium underline">
                Voir le panier
              </Link>
            )}
          </span>
        )}
      </p>

      {selected.deliveryLabel && (
        <p className="rounded-xl bg-white p-3 text-sm">
          <span className="font-medium">Livraison estimée</span> {selected.deliveryLabel}, en France
          métropolitaine, avec numéro de suivi.
        </p>
      )}

      {bundleTexts.length > 0 && (
        <ul className="border-sage/40 bg-sage/10 space-y-1 rounded-xl border p-3 text-sm">
          {bundleTexts.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
