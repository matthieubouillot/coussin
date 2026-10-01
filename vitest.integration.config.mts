import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/integration/test-database-url";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

// Tests d'intégration : vraie base Postgres DÉDIÉE aux tests (vidée entre chaque test).
const TEST_DATABASE_URL = testDatabaseUrl();

if (!/coussin_test|_test\b/.test(TEST_DATABASE_URL)) {
  throw new Error("Les tests d'intégration exigent une base dont le nom contient « _test »");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/unit/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // Une seule base partagée : les fichiers s'exécutent l'un après l'autre.
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      ADMIN_PATH: "gestion-test-0123456789",
      STRIPE_SECRET_KEY: "sk_test_integration_dummy",
      STRIPE_WEBHOOK_SECRET: "whsec_integration_test_secret",
      CRON_SECRET: "cron-secret-integration-test-0123456789abcdef",
      VERCEL_ENV: "development",
      LOCAL_DATA_DIR: path.join(os.tmpdir(), `coussin-integration-${process.pid}`),
    },
  },
});
