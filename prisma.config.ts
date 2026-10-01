import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Les migrations passent par la connexion directe (non poolée) : le pooler Neon
// (PgBouncer en mode transaction) ne supporte pas toutes les opérations de migration.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.dev.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
