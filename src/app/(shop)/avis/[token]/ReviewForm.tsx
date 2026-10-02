"use client";

import { useActionState } from "react";
import { submitReviewAction } from "./actions";

const input = "mt-1 min-h-11 w-full rounded-lg border border-cocoa/30 bg-white px-3";

export function ReviewForm({
  token,
  orderItemId,
  label,
  defaultName,
}: {
  token: string;
  orderItemId: string;
  label: string;
  defaultName: string;
}) {
  const [state, action, pending] = useActionState(submitReviewAction, null);
  if (state?.ok)
    return (
      <p role="status" className="rounded-2xl bg-white p-4">
        {state.message}
      </p>
    );
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-4">
      <h2 className="font-medium">{label}</h2>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <fieldset>
        <legend className="text-sm font-medium">Note</legend>
        <div className="mt-1 flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-1 text-sm">
              <input type="radio" name="rating" value={n} required className="accent-cocoa size-4" /> {n} ★
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">
        Votre avis
        <textarea name="body" required minLength={10} maxLength={2000} rows={4} className={`${input} py-2`} />
      </label>
      <label className="block text-sm font-medium">
        Nom affiché
        <input name="displayName" required defaultValue={defaultName} maxLength={40} className={input} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-cocoa min-h-11 w-full rounded-full px-6 font-medium text-white disabled:opacity-60"
      >
        Publier mon avis
      </button>
      <p aria-live="polite" className="text-cocoa text-sm">
        {state?.message}
      </p>
    </form>
  );
}
