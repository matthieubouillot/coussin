"use client";

import { useActionState } from "react";
import { regenerateBackupCodesAction } from "@/app/admin/(protected)/securite/actions";
import { Field, inputClass, secondaryButtonClass } from "@/components/admin/ui";

export function BackupCodesForm() {
  const [state, action, pending] = useActionState(regenerateBackupCodesAction, null);
  return (
    <form action={action} className="space-y-3">
      <Field label="Mot de passe">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        Régénérer les codes de secours
      </button>
      <p aria-live="polite" className={`text-sm ${state?.ok ? "text-emerald-700" : "text-red-700"}`}>
        {state?.message}
      </p>
      {state?.codes && (
        <ul className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-3 font-mono text-sm">
          {state.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
