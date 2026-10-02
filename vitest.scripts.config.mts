import "dotenv/config";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Scripts de développement exécutés avec Vitest (même résolution des modules que les tests,
// compatible avec les paquets uniquement ESM comme @react-pdf). Base : celle du fichier .env.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/unit/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: { include: ["scripts/**/*.run.ts"], environment: "node", testTimeout: 180_000 },
});
