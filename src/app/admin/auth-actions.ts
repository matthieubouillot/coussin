"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { auth } from "@/server/auth/auth";
import { adminHref } from "@/server/auth/admin-path";
import { requireAdminPendingTwoFactor } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { checkRateLimit } from "@/server/security/ratelimit";

export type FormState = { error: string } | null;

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Message volontairement identique dans tous les cas d'échec : ne révèle pas si le compte existe.
const INVALID = { error: "Identifiants invalides, ou compte temporairement verrouillé." };

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkRateLimit("adminLogin")))
    return { error: "Trop de tentatives. Réessayez dans 15 minutes." };

  const parsed = z
    .object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(128) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return INVALID;

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await audit("admin.login.locked", { actorId: user.id });
    return INVALID;
  }

  let result: Awaited<ReturnType<typeof auth.api.signInEmail>>;
  try {
    result = await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password, rememberMe: false },
      headers: await headers(),
    });
  } catch {
    if (user) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined,
        },
      });
      await audit(lock ? "admin.login.lockout" : "admin.login.failed", { actorId: user.id });
    } else {
      await audit("admin.login.unknown_account");
    }
    return INVALID;
  }

  if (user)
    await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await audit("admin.login.password_ok", { actorId: user?.id });

  // Mot de passe correct : la session n'est complète qu'après le code TOTP.
  if ("twoFactorRedirect" in result && result.twoFactorRedirect) redirect(adminHref("/2fa"));
  redirect(adminHref("/securite/activer-2fa"));
}

const codeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$|^[A-Za-z0-9-]{8,20}$/);

export async function verifyTwoFactorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkRateLimit("adminTotp")))
    return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { error: "Code invalide." };

  const isTotp = /^[0-9]{6}$/.test(parsed.data);
  try {
    const result = isTotp
      ? await auth.api.verifyTOTP({
          body: { code: parsed.data, trustDevice: false },
          headers: await headers(),
        })
      : await auth.api.verifyBackupCode({
          body: { code: parsed.data, trustDevice: false },
          headers: await headers(),
        });
    await audit(isTotp ? "admin.login.success" : "admin.login.success_backup_code", {
      actorId: result.user.id,
    });
  } catch {
    await audit("admin.login.totp_failed");
    return { error: "Code invalide ou expiré." };
  }
  redirect(adminHref());
}

export type EnrollState =
  | { step: "scan"; qrDataUrl: string; secretUri: string; backupCodes: string[]; error?: string }
  | { step: "password"; error?: string }
  | null;

export async function startEnrollmentAction(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  const admin = await requireAdminPendingTwoFactor();
  const password = z.string().min(1).max(128).safeParse(formData.get("password"));
  if (!password.success) return { step: "password", error: "Mot de passe requis." };
  try {
    const enabled = await auth.api.enableTwoFactor({
      body: { password: password.data, method: "totp" },
      headers: await headers(),
    });
    if (enabled.method !== "totp") throw new Error("Méthode 2FA inattendue");
    const { totpURI, backupCodes } = enabled;
    await audit("admin.2fa.enrollment_started", { actorId: admin.id });
    return {
      step: "scan",
      qrDataUrl: await QRCode.toDataURL(totpURI, { margin: 1, width: 240 }),
      secretUri: totpURI,
      backupCodes,
    };
  } catch {
    return { step: "password", error: "Mot de passe incorrect." };
  }
}

export async function confirmEnrollmentAction(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  const admin = await requireAdminPendingTwoFactor();
  if (!(await checkRateLimit("adminTotp"))) return { step: "password", error: "Trop de tentatives." };
  const code = z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/)
    .safeParse(formData.get("code"));
  const keep = {
    step: "scan" as const,
    qrDataUrl: String(formData.get("qrDataUrl") ?? ""),
    secretUri: String(formData.get("secretUri") ?? ""),
    backupCodes: String(formData.get("backupCodes") ?? "").split(","),
  };
  if (!code.success) return { ...keep, error: "Saisissez le code à 6 chiffres de l'application." };
  try {
    await auth.api.verifyTOTP({ body: { code: code.data }, headers: await headers() });
  } catch {
    return { ...keep, error: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez." };
  }
  await audit("admin.2fa.enabled", { actorId: admin.id });
  redirect(adminHref());
}

export async function logoutAction(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  await auth.api.signOut({ headers: await headers() });
  await audit("admin.logout", { actorId: session?.user.id });
  redirect(adminHref("/login"));
}
