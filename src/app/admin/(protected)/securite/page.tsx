import { headers } from "next/headers";
import { ActionForm } from "@/components/admin/ActionForm";
import { BackupCodesForm } from "@/components/admin/BackupCodesForm";
import { Card, Field, inputClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { auth } from "@/server/auth/auth";
import { currentSessionId, requireAdmin } from "@/server/auth/require-admin";
import { changePasswordAction, revokeOtherSessionsAction, revokeSessionAction } from "./actions";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function SecurityPage() {
  await requireAdmin();
  const [sessions, currentId] = await Promise.all([
    auth.api.listSessions({ headers: await headers() }),
    currentSessionId(),
  ]);

  return (
    <>
      <PageTitle>Sécurité du compte</PageTitle>
      <Card title="Sessions ouvertes">
        <p className="mb-2 text-xs text-stone-500">
          Une session expire au bout de 8 h. Fermez toute session que vous ne reconnaissez pas.
        </p>
        <ul className="space-y-2 text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3">
              <span>
                {s.id === currentId ? <strong>Cette session</strong> : "Autre session"} — ouverte le{" "}
                {dateTime.format(new Date(s.createdAt))} — expire le {dateTime.format(new Date(s.expiresAt))}{" "}
                — {s.userAgent?.slice(0, 80) ?? "navigateur inconnu"}
              </span>
              {s.id !== currentId && (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="token" value={s.token} />
                  <button type="submit" className="text-red-700 underline">
                    Fermer
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={revokeOtherSessionsAction} className="mt-3">
          <button type="submit" className={secondaryButtonClass}>
            Fermer toutes les autres sessions
          </button>
        </form>
      </Card>

      <Card title="Changer le mot de passe">
        <ActionForm
          action={changePasswordAction}
          submitLabel="Changer le mot de passe"
          submitClassName={secondaryButtonClass}
          className="grid gap-3 md:grid-cols-3"
        >
          <Field label="Mot de passe actuel">
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </Field>
          <Field label="Nouveau mot de passe (12+)">
            <input
              name="newPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
          <Field label="Confirmation">
            <input
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
        </ActionForm>
      </Card>

      <Card title="Codes de secours de la double authentification">
        <BackupCodesForm />
      </Card>
    </>
  );
}
