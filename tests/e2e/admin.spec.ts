import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { secretFromUri, totp } from "../support/totp";

const ADMIN = `/${process.env.ADMIN_PATH ?? "gestion-dev-local"}`;
const PASSWORD = "MotDePasse-E2E-2026!";

function createAdmin(email: string) {
  execFileSync("pnpm", ["admin:create", email, "Admin E2E"], {
    input: `${PASSWORD}\n${PASSWORD}\n`,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Continuer" }).click();
}

test.describe.configure({ mode: "serial" });

test("sans session, l'admin redirige vers la connexion et les API admin sont invisibles", async ({
  page,
  request,
}) => {
  await page.goto(`${ADMIN}/commandes`);
  await expect(page).toHaveURL(new RegExp(`${ADMIN}/login$`));
  expect((await request.get("/api/admin/exports?registre=recettes&annee=2026&periode=annee")).status()).toBe(
    404,
  );
  expect((await request.get("/api/admin/documents/inexistant")).status()).toBe(404);
  expect((await request.get("/api/admin/clients/x/export")).status()).toBe(404);
});

test("première connexion : 2FA obligatoire, puis accès à l'administration", async ({ page }, testInfo) => {
  const email = `admin-${Date.now()}-${testInfo.project.name}@example.test`;
  createAdmin(email);

  await login(page, email);
  await expect(page).toHaveURL(/activer-2fa/);
  // Tant que la 2FA n'est pas active, aucune page admin n'est accessible.
  await page.goto(`${ADMIN}/commandes`);
  await expect(page).toHaveURL(/activer-2fa/);

  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Générer ma clé" }).click();
  const secret = secretFromUri(await page.locator('input[name="secretUri"]').inputValue());
  await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
  await page.getByRole("button", { name: /Activer la double authentification/ }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();

  for (const [link, heading] of [
    ["Commandes", /Commandes/],
    ["Produit", "Produit"],
    ["Comptabilité", "Comptabilité"],
    ["Réglages", "Réglages"],
    ["Journal d'audit", "Journal d'audit"],
  ] as const) {
    await page
      .getByRole("navigation", { name: "Administration" })
      .getByRole("link", { name: link, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await expect(page.getByText("admin.2fa.enabled").first()).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/login$/);

  // Reconnexion : mot de passe puis code TOTP ; un mauvais code est refusé.
  await login(page, email);
  await expect(page).toHaveURL(/\/2fa$/);
  await page.getByLabel(/Code/).fill("000000");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Code invalide ou expiré.")).toBeVisible();
  await page.getByLabel(/Code/).fill(totp(secret));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();

  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.includes("session_token"));
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");
});

test("verrouillage temporaire après 5 mots de passe faux", async ({ page }, testInfo) => {
  const email = `lock-${Date.now()}-${testInfo.project.name}@example.test`;
  createAdmin(email);
  for (let i = 0; i < 5; i++) {
    await login(page, email, "mauvais-mot-de-passe");
    await expect(page.getByText("Identifiants invalides")).toBeVisible();
  }
  // Le bon mot de passe est désormais refusé lui aussi, avec le même message.
  await login(page, email);
  await expect(page.getByText("Identifiants invalides")).toBeVisible();
  await expect(page).toHaveURL(/login$/);
});
