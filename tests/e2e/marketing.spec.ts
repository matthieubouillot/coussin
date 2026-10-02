import { expect, test } from "@playwright/test";

const isTikTok = (url: string) => /tiktok\.com/.test(url);

test("pixel TikTok : jamais avant consentement, chargé après « Tout accepter »", async ({ page }) => {
  const tiktok: string[] = [];
  // Les requêtes vers TikTok sont interceptées (comptées puis bloquées) : aucun appel réel.
  await page.route(/tiktok\.com/, (route) => {
    tiktok.push(route.request().url());
    return route.abort();
  });

  const first = await page.goto("/");
  expect(first?.headers()["content-security-policy"]).not.toContain("tiktok.com");
  await page.waitForLoadState("networkidle");
  expect(tiktok).toEqual([]);

  await page.getByRole("button", { name: "Tout accepter" }).click();
  await expect
    .poll(() => tiktok.some((u) => u.includes("analytics.tiktok.com/i18n/pixel/events.js")))
    .toBe(true);
  const after = await page.reload();
  expect(after?.headers()["content-security-policy"]).toContain("https://analytics.tiktok.com");
});

test("refus : aucun pixel, même après navigation", async ({ page }) => {
  const thirdParty: string[] = [];
  page.on("request", (r) => isTikTok(r.url()) && thirdParty.push(r.url()));
  await page.goto("/");
  await page.getByRole("button", { name: "Tout refuser" }).click();
  await page.goto("/cgv");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(thirdParty).toEqual([]);
});

test("provenance (UTM) gardée en mémoire jusqu'au formulaire de commande, sans cookie si refus", async ({
  page,
  context,
}) => {
  await page.goto("/?utm_source=tiktok&utm_medium=paid&utm_campaign=noel-2026");
  await page.getByRole("button", { name: "Tout refuser" }).click();
  await page.locator('label:has-text("M — 60")').click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("link", { name: /^Panier, / })).toHaveText("Panier (1)");
  await page.getByRole("link", { name: /^Panier, / }).click();
  await expect(page).toHaveURL(/\/panier$/);
  await expect(page.locator('input[name="utm_campaign"]')).toHaveValue("noel-2026");
  await expect(page.locator('input[name="utm_source"]')).toHaveValue("tiktok");
  await expect(page.locator('input[name="marketingEventId"]')).toHaveValue(/^[a-f0-9]{32}$/);
  expect((await context.cookies()).map((c) => c.name)).not.toContain("attribution");
});
