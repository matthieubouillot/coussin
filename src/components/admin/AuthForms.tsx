"use client";

import { useActionState } from "react";
import {
  confirmEnrollmentAction,
  loginAction,
  startEnrollmentAction,
  verifyTwoFactorAction,
} from "@/app/admin/auth-actions";
import { buttonClass, Field, inputClass } from "@/components/admin/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="username" className={inputClass} />
      </Field>
      <Field label="Mot de passe">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>
      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        Continuer
      </button>
      <p aria-live="polite" className="text-sm text-red-700">
        {state?.error}
      </p>
    </form>
  );
}

export function TwoFactorForm() {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Code de l'application d'authentification" hint="6 chiffres, ou un code de secours.">
        <input
          name="code"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
          className={inputClass}
        />
      </Field>
      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        Valider
      </button>
      <p aria-live="polite" className="text-sm text-red-700">
        {state?.error}
      </p>
    </form>
  );
}

export function EnrollmentForm() {
  const [startState, start, starting] = useActionState(startEnrollmentAction, null);
  const [confirmState, confirm, confirming] = useActionState(confirmEnrollmentAction, null);
  const scan = confirmState?.step === "scan" ? confirmState : startState?.step === "scan" ? startState : null;

  if (!scan) {
    return (
      <form action={start} className="space-y-4">
        <p className="text-sm">
          La double authentification est obligatoire. Confirmez votre mot de passe pour générer votre clé.
        </p>
        <Field label="Mot de passe">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={starting} className={`${buttonClass} w-full`}>
          Générer ma clé
        </button>
        <p aria-live="polite" className="text-sm text-red-700">
          {startState?.step === "password" && startState.error}
        </p>
      </form>
    );
  }

  return (
    <form action={confirm} className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Scannez ce QR code avec votre application (Google Authenticator, 1Password, Aegis…).</li>
        <li>Notez les codes de secours dans un endroit sûr : ils ne seront plus affichés.</li>
        <li>Saisissez le code à 6 chiffres affiché par l&apos;application.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- image data: générée côté serveur */}
      <img
        src={scan.qrDataUrl}
        alt="QR code de configuration de la double authentification"
        width={240}
        height={240}
      />
      <ul className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-3 font-mono text-sm">
        {scan.backupCodes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <input type="hidden" name="qrDataUrl" value={scan.qrDataUrl} />
      <input type="hidden" name="secretUri" value={scan.secretUri} />
      <input type="hidden" name="backupCodes" value={scan.backupCodes.join(",")} />
      <Field label="Code à 6 chiffres">
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" className={inputClass} />
      </Field>
      <button type="submit" disabled={confirming} className={`${buttonClass} w-full`}>
        Activer la double authentification
      </button>
      <p aria-live="polite" className="text-sm text-red-700">
        {confirmState?.step === "scan" && confirmState.error}
      </p>
    </form>
  );
}
