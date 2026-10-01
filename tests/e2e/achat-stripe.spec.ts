import { expect, test } from "@playwright/test";

/**
 * Parcours d'achat complet en mode TEST Stripe : panier → Stripe Checkout (carte 4242) → webhook
 * → commande payée. Nécessite des clés de test Stripe et le relais des webhooks en local :
 *   stripe listen --forward-to localhost:3100/api/webhooks/stripe
 * puis E2E_STRIPE=1 pnpm test:e2e achat-stripe
 */
test.skip(!process.env.E2E_STRIPE, "Parcours Stripe réel : lancer avec E2E_STRIPE=1 (voir README)");

test("achat complet d'un coussin M par carte de test", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Tout refuser" }).click();
  await page.locator('label:has-text("M — 60")').click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("link", { name: /^Panier, / })).toHaveText("Panier (1)");

  await page.goto("/panier");
  await page.getByRole("checkbox", { name: /conditions générales/ }).check();
  await page.getByRole("button", { name: "Commander avec obligation de paiement" }).click();

  await page.waitForURL(/checkout\.stripe\.com/);
  await page.getByLabel("Email").fill("acheteur.test@example.fr");
  await page.getByLabel("Nom complet").fill("Camille Martin");
  await page.getByLabel("Ligne d'adresse 1").fill("12 rue des Lilas");
  await page.getByLabel("Code postal").fill("69001");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByLabel(/Téléphone/).fill("0612345678");
  await page.getByLabel("Numéro de carte").fill("4242424242424242");
  await page.getByLabel("Expiration").fill("12 / 34");
  await page.getByLabel("CVC").fill("123");
  await page.getByLabel(/Nom du titulaire/).fill("Camille Martin");
  await page.getByTestId("hosted-payment-submit-button").click();

  await page.waitForURL(/\/commande\/confirmation/);
  await expect(page.getByRole("heading", { name: "Merci, votre commande est confirmée" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("link", { name: /^Panier, / })).toHaveText("Panier (0)");
});
