"use client";

import { useActionState } from "react";
import { applyPromoAction } from "@/app/(shop)/panier/actions";

export function PromoCodeForm() {
  const [state, formAction, pending] = useActionState(applyPromoAction, null);
  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="promoCode" className="block text-sm font-medium">
        Code promo
      </label>
      <div className="flex gap-2">
        <input
          id="promoCode"
          name="promoCode"
          autoComplete="off"
          maxLength={40}
          className="border-cocoa/30 min-h-11 flex-1 rounded-lg border bg-white px-3 uppercase"
        />
        <button
          type="submit"
          disabled={pending}
          className="border-cocoa min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-60"
        >
          Appliquer
        </button>
      </div>
      <p aria-live="polite" className={`text-sm ${state?.ok ? "text-sage" : "text-cocoa"}`}>
        {state?.message}
      </p>
    </form>
  );
}
