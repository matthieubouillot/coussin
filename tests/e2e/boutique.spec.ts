import { expect, test, type Page } from "@playwright/test";

// Ces tests supposent la base de dev/CI initialisée par `pnpm db:seed`
// (taille M à 29,90 €, L à 44,90 €, livraison 4,90 € offerte dès 49 €).

async function refuseCookies(page: Page) {
  await page.getByRole("button", { name: "Tout refuser" }).click();
  await expect(page.getByRole("dialog", { name: /cookies/ })).toBeHidden();
}

/** Ajoute une taille et attend que le compteur du panier reflète le nouveau total d'articles. */
async function addSize(page: Page, size: "M" | "L", expectedCount: number) {
  await page.locator(`label:has-text("${size} — 60")`).click();
  await page.getByLabel("Quantité").selectOption("1");
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("link", { name: /^Panier, / })).toHaveText(`Panier (${expectedCount})`);
}

test.describe("bandeau cookies", () => {
  test("aucune requête vers un tiers avant consentement", async ({ page, baseURL }) => {
    const thirdParty: string[] = [];
    page.on("request", (req) => {
      if (!req.url().startsWith(baseURL!) && !req.url().startsWith("data:")) thirdParty.push(req.url());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(thirdParty).toEqual([]);
  });

  test("refuser est aussi simple qu'accepter et le choix est mémorisé", async ({ page, context }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: /cookies/ });
    await expect(dialog).toBeVisible();
    // Même niveau : les deux boutons sont visibles d'emblée, sans scroll ni second écran.
    await expect(dialog.getByRole("button", { name: "Tout refuser" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tout accepter" })).toBeVisible();

    await refuseCookies(page);
    const consent = (await context.cookies()).find((c) => c.name === "consentement");
    expect(consent?.httpOnly).toBe(true);
    expect(JSON.parse(decodeURIComponent(consent!.value)).choices).toEqual({ ads: false });

    await page.reload();
    await expect(page.getByRole("dialog", { name: /cookies/ })).toBeHidden();
  });

  test("le lien « Gérer mes cookies » rouvre les choix détaillés", async ({ page }) => {
    await page.goto("/");
    await refuseCookies(page);
    await page.getByRole("button", { name: "Gérer mes cookies" }).click();
    const dialog = page.getByRole("dialog", { name: /cookies/ });
    await expect(dialog.getByRole("checkbox", { name: /Publicité/ })).not.toBeChecked();
    await dialog.getByRole("checkbox", { name: /Publicité/ }).check();
    await dialog.getByRole("button", { name: "Enregistrer mes choix" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("page produit et panier", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await refuseCookies(page);
  });

  test("affiche le produit, le prix TTC, les tailles et un délai estimé", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Coussin auto-chauffant");
    await expect(page.getByText("29,90 €").first()).toBeVisible();
    await expect(page.getByText(/Livraison estimée/)).toBeVisible();
    await expect(page.getByText("Guide des tailles", { exact: true })).toBeVisible();
    // Aucun avis inventé : la section l'indique honnêtement.
    await expect(page.getByText("Aucun avis pour le moment.")).toBeVisible();
  });

  test("un coussin M : 29,90 € + 4,90 € de livraison", async ({ page }) => {
    await addSize(page, "M", 1);
    await page.goto("/panier");
    await expect(page.getByText("Total TTC").locator("..")).toContainText("34,80 €");
  });

  test("M + L : livraison offerte dès 49 €", async ({ page }) => {
    await addSize(page, "M", 1);
    await addSize(page, "L", 2);
    await page.goto("/panier");
    await expect(page.getByText("Offerte", { exact: true })).toBeVisible();
    await expect(page.getByText("Total TTC").locator("..")).toContainText("74,80 €");
  });

  test("retirer une ligne vide le panier", async ({ page }) => {
    await addSize(page, "M", 1);
    await page.goto("/panier");
    await page.getByRole("button", { name: /Retirer/ }).click();
    await expect(page.getByText("Votre panier est vide.")).toBeVisible();
  });

  test("un code promo inexistant est refusé", async ({ page }) => {
    await addSize(page, "M", 1);
    await page.goto("/panier");
    await page.getByLabel("Code promo").fill("FAUXCODE");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page.getByText("Ce code n'existe pas ou n'est plus valable.")).toBeVisible();
  });

  test("un cookie panier falsifié est ignoré", async ({ page, context, baseURL }) => {
    const forged = Buffer.from(JSON.stringify({ v: 1, items: [{ variantId: "x", quantity: 5 }] })).toString(
      "base64url",
    );
    await context.addCookies([{ name: "panier", value: `${forged}.fausse-signature`, url: baseURL! }]);
    await page.goto("/panier");
    await expect(page.getByText("Votre panier est vide.")).toBeVisible();
  });

  test("le bouton de commande porte la mention légale exacte", async ({ page }) => {
    await addSize(page, "M", 1);
    await page.goto("/panier");
    await expect(page.getByRole("button", { name: "Commander avec obligation de paiement" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /conditions générales de vente/ })).toBeVisible();
  });
});

test("toutes les pages légales sont liées depuis le pied de page", async ({ page }) => {
  await page.goto("/");
  await refuseCookies(page);
  const links = page.getByRole("navigation", { name: "Informations légales" }).getByRole("link");
  const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  expect(hrefs).toEqual(["/mentions-legales", "/cgv", "/confidentialite", "/cookies", "/avis-clients"]);
  for (const href of hrefs) {
    const response = await page.goto(href!);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Informations légales" })).toBeVisible();
  }
});
