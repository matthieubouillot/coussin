import "server-only";
import type { SupplierAdapterKind } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { secretsEncryptionKey } from "@/server/secrets";
import { decryptSecret, encryptSecret } from "@/server/security/encryption";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string | null;
  accessExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
};

export async function loadTokens(adapter: SupplierAdapterKind): Promise<StoredTokens | null> {
  const row = await db.supplierCredential.findUnique({ where: { adapter } });
  if (!row) return null;
  const key = secretsEncryptionKey();
  return {
    accessToken: decryptSecret(row.accessTokenEnc, key),
    refreshToken: row.refreshTokenEnc ? decryptSecret(row.refreshTokenEnc, key) : null,
    accessExpiresAt: row.accessExpiresAt,
    refreshExpiresAt: row.refreshExpiresAt,
  };
}

export async function saveTokens(adapter: SupplierAdapterKind, tokens: StoredTokens): Promise<void> {
  const key = secretsEncryptionKey();
  const data = {
    accessTokenEnc: encryptSecret(tokens.accessToken, key),
    refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken, key) : null,
    accessExpiresAt: tokens.accessExpiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  };
  await db.supplierCredential.upsert({ where: { adapter }, create: { adapter, ...data }, update: data });
}
