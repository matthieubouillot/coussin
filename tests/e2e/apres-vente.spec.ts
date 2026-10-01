import { expect, test, type Page } from "@playwright/test";

async function refuseCookies(page: Page) {
  await page.getByRole("button", { name: "Tout refuser" }).click();
}

/** Attend que le widget Turnstile (clés de test Cloudflare : toujours valide) ait produit son jeton. */
async function waitForTurnstile(page: Page) {
  await expect(page.locator('input[name="turnstileToken"]')).toHaveValue(/.+/, { timeout: 15_000 });
}

test("suivi : une commande inconnue n'est pas révélée", async ({ page }) => {
  await page.goto("/suivi");
  await refuseCookies(page);
  await page.getByLabel("Numéro de commande").fill("C-ABCDEFGH");
  await page.getByLabel(/Adresse email/).fill("personne@example.fr");
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Voir ma commande" }).click();
  await expect(page.getByText("Aucune commande ne correspond")).toBeVisible();
});

test("contact : le message est envoyé, sans violation CSP malgré Turnstile", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.goto("/contact");
  await refuseCookies(page);
  await page.getByLabel("Nom").fill("Camille");
  await page.getByLabel("Email").fill("camille@example.fr");
  await page.getByLabel("Message").fill("Bonjour, le coussin convient-il à un lapin ?");
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("votre message a bien été envoyé")).toBeVisible();
  expect(violations).toEqual([]);
});

test("rétractation : le formulaire type est téléchargeable en PDF", async ({ request }) => {
  const response = await request.get("/retractation/formulaire");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("commande : l'acceptation des CGV est exigée avant le paiement", async ({ page }) => {
  await page.goto("/");
  await refuseCookies(page);
  await page.locator('label:has-text("M — 60")').click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("link", { name: /^Panier, / })).toHaveText("Panier (1)");
  await page.goto("/panier");
  const button = page.getByRole("button", { name: "Commander avec obligation de paiement" });
  await button.click();
  // Validation native du navigateur : on reste sur le panier tant que la case n'est pas cochée.
  await expect(page).toHaveURL(/\/panier$/);
  expect(
    await page
      .getByRole("checkbox", { name: /conditions générales/ })
      .evaluate((el: HTMLInputElement) => el.validity.valueMissing),
  ).toBe(true);
});
