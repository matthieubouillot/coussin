"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { auth } from "@/server/auth/auth";
import { requireAdmin } from "@/server/auth/require-admin";

export type ActionState = { ok: boolean; message: string } | null;
export type BackupCodesState = { ok: boolean; message: string; codes?: string[] } | null;

export async function revokeOtherSessionsAction(): Promise<void> {
  const admin = await requireAdmin();
  await auth.api.revokeOtherSessions({ headers: await headers() });
  await audit("admin.sessions.revoke_others", { actorId: admin.id });
  revalidatePath("/admin/securite");
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const token = z.string().min(10).max(200).safeParse(formData.get("token"));
  if (!token.success) return;
  await auth.api.revokeSession({ body: { token: token.data }, headers: await headers() });
  await audit("admin.sessions.revoke", { actorId: admin.id });
  revalidatePath("/admin/securite");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(12, "12 caractères minimum").max(128),
      confirm: z.string(),
    })
    .refine((p) => p.newPassword === p.confirm, "La confirmation ne correspond pas")
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch {
    return { ok: false, message: "Mot de passe actuel incorrect." };
  }
  await audit("admin.password.changed", { actorId: admin.id });
  return { ok: true, message: "Mot de passe modifié ; les autres sessions ont été fermées." };
}

export async function regenerateBackupCodesAction(
  _prev: BackupCodesState,
  formData: FormData,
): Promise<BackupCodesState> {
  const admin = await requireAdmin();
  const password = z.string().min(1).max(128).safeParse(formData.get("password"));
  if (!password.success) return { ok: false, message: "Mot de passe requis." };
  try {
    const { backupCodes } = await auth.api.generateBackupCodes({
      body: { password: password.data },
      headers: await headers(),
    });
    await audit("admin.2fa.backup_codes_regenerated", { actorId: admin.id });
    return {
      ok: true,
      message: "Nouveaux codes générés : les anciens ne fonctionnent plus.",
      codes: backupCodes,
    };
  } catch {
    return { ok: false, message: "Mot de passe incorrect." };
  }
}
