"use client";

import { useActionState, type ReactNode } from "react";

type State = { ok: boolean; message: string } | null;

/** Formulaire admin générique : Server Action + message de retour accessible. */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitClassName,
  className = "space-y-3",
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  children: ReactNode;
  submitLabel: string;
  submitClassName: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <button type="submit" disabled={pending} className={submitClassName}>
        {pending ? "En cours…" : submitLabel}
      </button>
      <p aria-live="polite" className={`text-sm ${state?.ok ? "text-emerald-700" : "text-red-700"}`}>
        {state?.message}
      </p>
    </form>
  );
}
