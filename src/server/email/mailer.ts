import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReactElement } from "react";
import { render } from "react-email";
import { Resend } from "resend";
import type { EmailType } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";

/**
 * Envoi d'emails transactionnels, exactement une fois par `dedupKey`.
 *
 * Le journal EmailLog est écrit AVANT l'envoi (contrainte unique) : deux exécutions concurrentes
 * ne peuvent pas envoyer deux fois le même email. Si l'envoi échoue, la ligne est retirée pour
 * permettre une nouvelle tentative. En dev sans clé Resend, l'email est écrit dans `.data/emails`.
 */

export type Attachment = { filename: string; content: Buffer; contentType: string };

export type SendEmailParams = {
  type: EmailType;
  dedupKey: string;
  to: string;
  subject: string;
  react: ReactElement;
  orderId?: string;
  attachments?: Attachment[];
};

let resendClient: Resend | undefined;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function sendEmailOnce(params: SendEmailParams): Promise<"sent" | "already-sent"> {
  try {
    await db.emailLog.create({
      data: { type: params.type, dedupKey: params.dedupKey, orderId: params.orderId },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "already-sent";
    throw error;
  }

  try {
    const resendId = await deliver(params);
    await db.emailLog.update({ where: { dedupKey: params.dedupKey }, data: { resendId } });
    return "sent";
  } catch (error) {
    await db.emailLog.delete({ where: { dedupKey: params.dedupKey } });
    throw error;
  }
}

async function deliver(params: SendEmailParams): Promise<string | null> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();

  if (!RESEND_API_KEY || !EMAIL_FROM) {
    const html = await render(params.react);
    const dir = path.join(process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data"), "emails");
    await mkdir(dir, { recursive: true });
    const safeName = params.dedupKey.replace(/[^a-zA-Z0-9_-]/g, "_");
    await writeFile(
      path.join(dir, `${safeName}.html`),
      `<!-- À : ${params.to} | ${params.subject} -->\n${html}`,
    );
    for (const a of params.attachments ?? [])
      await writeFile(path.join(dir, `${safeName}--${a.filename}`), a.content);
    return null;
  }

  resendClient ??= new Resend(RESEND_API_KEY);
  const { data, error } = await resendClient.emails.send(
    {
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      react: params.react,
      attachments: params.attachments,
    },
    // Double sécurité côté Resend en cas de réessai réseau.
    { idempotencyKey: params.dedupKey },
  );
  if (error) throw new Error(`Resend : ${error.name}`);
  return data?.id ?? null;
}
