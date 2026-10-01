"use client";

import { useActionState } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { withdrawalAction } from "./actions";

export function WithdrawalForm({ siteKey, nonce }: { siteKey: string; nonce?: string }) {
  const [state, formAction, pending] = useActionState(withdrawalAction, null);
  if (state?.ok) {
    return (
      <p role="status" className="mt-6 rounded-2xl bg-white p-4">
        {state.message}
      </p>
    );
  }
  return (
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
      <label className="block text-sm font-medium">
        Message (facultatif — aucun motif n&apos;est exigé)
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          className="border-cocoa/30 mt-1 w-full rounded-lg border p-3"
        />
      </label>
      <Turnstile siteKey={siteKey} nonce={nonce} />
      <button
        type="submit"
        disabled={pending}
        className="bg-cocoa min-h-11 w-full rounded-full px-6 font-medium text-white disabled:opacity-60"
      >
        Je me rétracte
      </button>
      <p aria-live="polite" className="text-cocoa text-sm">
        {state?.message}
      </p>
    </form>
  );
}
