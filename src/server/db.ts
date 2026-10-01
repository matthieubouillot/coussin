import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";

// En dev, le rechargement à chaud réévalue ce module : on garde une seule instance
// pour ne pas épuiser les connexions Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (env().NODE_ENV !== "production") globalForPrisma.prisma = db;
