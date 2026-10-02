import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { clientFingerprint } from "@/server/security/ratelimit";

/**
 * Journal d'audit : connexions admin, modifications sensibles, remboursements.
 * Jamais de donnée personnelle en clair dans `metadata` (identifiants internes uniquement).
 */
export async function audit(
  action: string,
  params: {
    actorId?: string | null;
    targetType?: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
  } = {},
): Promise<void> {
  let ipHash: string | null = null;
  try {
    ipHash = await clientFingerprint();
  } catch {
    // Hors requête HTTP (cron, script) : pas d'IP.
  }
  await db.auditLog.create({
    data: {
      action,
      actorId: params.actorId ?? null,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata,
      ipHash,
    },
  });
}
