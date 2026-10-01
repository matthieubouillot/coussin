import { expect, test } from "@playwright/test";

const ADMIN_PATH = process.env.ADMIN_PATH ?? "gestion-dev-local";

test("la page d'accueil répond avec les en-têtes de sécurité", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("le nonce change à chaque requête", async ({ request }) => {
  const nonceOf = async () =>
    (await request.get("/")).headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
  const [a, b] = [await nonceOf(), await nonceOf()];
  expect(a).toBeTruthy();
  expect(a).not.toBe(b);
});

test("aucune erreur CSP dans la console", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});

test("le chemin /admin n'existe pas publiquement", async ({ request }) => {
  const response = await request.get("/admin");
  expect(response.status()).toBe(404);
});

test("le chemin admin secret est servi et non indexable", async ({ request }) => {
  const response = await request.get(`/${ADMIN_PATH}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
});
