import "server-only";
import { AdminNotificationEmail } from "@/emails/TransactionalEmails";
import { env } from "@/server/env";
import { sendEmailOnce } from "@/server/email/mailer";
import { emailShop } from "@/server/email/shop-identity";

/**
 * Alerte email à l'admin, envoyée une seule fois par clé.
 * Ne doit jamais faire échouer le traitement qui l'appelle : une alerte perdue est journalisée.
 */
export async function notifyAdmin(dedupKey: string, title: string, lines: string[]): Promise<void> {
  const to = env().ADMIN_ALERT_EMAIL;
  if (!to) {
    console.warn(`[alerte admin non envoyée : ADMIN_ALERT_EMAIL absent] ${title}`);
    return;
  }
  try {
    await sendEmailOnce({
      type: "ADMIN_ALERT",
      dedupKey: `admin:${dedupKey}`,
      to,
      subject: `[Boutique] ${title}`,
      react: AdminNotificationEmail({ shop: await emailShop(), title, lines }),
    });
  } catch (error) {
    console.error("Alerte admin non envoyée", title, error instanceof Error ? error.message : error);
  }
}
