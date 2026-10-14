import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { anonymizeCustomer } from "@/server/gdpr/customers";

/**
 * Durées de conservation (décision Q15, politique de confidentialité, docs/RGPD.md), appliquées
 * chaque jour. Les factures et avoirs ne sont JAMAIS supprimés (10 ans, obligation comptable) :
 * un client inactif est anonymisé, ses pièces comptables restent intactes.
 */
export const RETENTION = {
  customerInactivityYears: 3,
  contactMessageMonths: 12,
  auditLogMonths: 12,
  consentProofMonths: 6,
  technicalLogDays: 90,
  expiredReviewInviteDays: 30,
} as const;

function monthsAgo(months: number, now: Date): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

export type RetentionReport = Record<string, number>;

export async function applyRetention(now = new Date()): Promise<RetentionReport> {
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  const [contacts, audits, consents, webhooks, invites, sessions, verifications] = await Promise.all([
    db.contactMessage.deleteMany({
      where: { createdAt: { lt: monthsAgo(RETENTION.contactMessageMonths, now) } },
    }),
    db.auditLog.deleteMany({ where: { createdAt: { lt: monthsAgo(RETENTION.auditLogMonths, now) } } }),
    db.consentRecord.deleteMany({
      where: { createdAt: { lt: monthsAgo(RETENTION.consentProofMonths, now) } },
    }),
    db.processedWebhookEvent.deleteMany({
      where: { processedAt: { lt: daysAgo(RETENTION.technicalLogDays) } },
    }),
    db.reviewInvite.deleteMany({ where: { expiresAt: { lt: daysAgo(RETENTION.expiredReviewInviteDays) } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);

  // Clients sans activité depuis 3 ans (ni commande, ni contact) : anonymisés, un par un.
  const inactive = await db.customer.findMany({
    where: {
      anonymizedAt: null,
      lastActivityAt: { lt: monthsAgo(RETENTION.customerInactivityYears * 12, now) },
    },
    select: { id: true },
    take: 200,
  });
  for (const customer of inactive) await anonymizeCustomer(customer.id);

  // Paniers abandonnés : aucune donnée personnelle n'y reste, mais le contexte publicitaire éventuel est effacé.
  const abandoned = await db.order.updateMany({
    where: {
      status: { in: ["PENDING_PAYMENT", "CANCELLED"] },
      paidAt: null,
      createdAt: { lt: daysAgo(1) },
      NOT: { marketingContext: { equals: Prisma.DbNull } },
    },
    data: { marketingContext: Prisma.DbNull },
  });

  return {
    contactMessages: contacts.count,
    auditLogs: audits.count,
    consentProofs: consents.count,
    webhookEvents: webhooks.count,
    reviewInvites: invites.count,
    expiredSessions: sessions.count + verifications.count,
    customersAnonymized: inactive.length,
    abandonedCartsCleaned: abandoned.count,
  };
}
