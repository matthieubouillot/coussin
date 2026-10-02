import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Contrôle automatique WCAG 2.2 niveau AA (axe-core) des pages principales.
// Un contrôle automatique ne remplace pas une vérification manuelle (clavier, lecteur d'écran).

const PAGES = [
  "/",
  "/panier",
  "/cgv",
  "/contact",
  "/suivi",
  "/retractation",
  "/mentions-legales",
  "/confidentialite",
];

for (const path of PAGES) {
  test(`accessibilité WCAG 2.2 AA : ${path}`, async ({ page }) => {
    await page.goto(path);
    // « load » et non « networkidle » : le widget anti-robot interroge Cloudflare en continu.
    await page.waitForLoadState("load");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      // Le widget anti-robot de Cloudflare est une iframe tierce, hors de notre contrôle.
      .exclude('iframe[src*="challenges.cloudflare.com"]')
      .analyze();
    expect(
      results.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}

test("accessibilité : écran de connexion admin", async ({ page }) => {
  await page.goto(`/${process.env.ADMIN_PATH ?? "gestion-dev-local"}/login`);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
