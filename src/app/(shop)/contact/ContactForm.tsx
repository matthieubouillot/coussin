"use client";

import { useActionState } from "react";
import { Turnstile } from "@/components/ui/Turnstile";
import { contactAction } from "./actions";

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-cocoa/30 px-3";

export function ContactForm({ siteKey, nonce }: { siteKey: string; nonce?: string }) {
  const [state, formAction, pending] = useActionState(contactAction, null);
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
        Nom
        <input name="name" required maxLength={100} autoComplete="name" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Numéro de commande (facultatif)
        <input
          name="orderNumber"
          placeholder="C-XXXXXXXX"
          autoComplete="off"
          className={`${inputClass} uppercase`}
        />
      </label>
      <label className="block text-sm font-medium">
        Message
        <textarea
          name="body"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className="border-cocoa/30 mt-1 w-full rounded-lg border p-3"
        />
      </label>
      <Turnstile siteKey={siteKey} nonce={nonce} />
      <button
        type="submit"
        disabled={pending}
        className="bg-cocoa min-h-11 w-full rounded-full px-6 font-medium text-white disabled:opacity-60"
      >
        Envoyer
      </button>
      <p aria-live="polite" className="text-cocoa text-sm">
        {state?.message}
      </p>
      <p className="text-ink/70 text-xs">
        Vos données servent uniquement à répondre à votre message et sont conservées 1 an.{" "}
        <a href="/confidentialite" className="underline">
          En savoir plus
        </a>
      </p>
    </form>
  );
}
