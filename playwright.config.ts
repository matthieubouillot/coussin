import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Un problème systémique (base, serveur) doit faire échouer vite plutôt que tout réessayer.
  maxFailures: process.env.CI ? 5 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [
    // L'administration est un outil desktop : ses tests ne tournent qu'une fois (limites de connexion partagées).
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /admin\.spec\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // On teste le build de production (CSP sans unsafe-eval, en-têtes réels).
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
