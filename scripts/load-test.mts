/**
 * Test de charge léger (local uniquement, hors CI) — voir docs/PERFORMANCE.md.
 *   1. Faux Stripe : node scripts/stripe-mock.mjs
 *   2. Serveur de production sur une base de TEST, branché sur le faux Stripe (STRIPE_API_BASE)
 *   3. npx tsx scripts/load-test.mts http://localhost:3300
 * Chaque client simulé a sa propre IP (en-tête x-forwarded-for, réécrit par Vercel en production).
 */
import { chromium, type Browser } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3300";
const pct = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor((p / 100) * values.length))]!;

async function pageLoad(concurrency: number, durationMs: number) {
  const latencies: number[] = [];
  let errors = 0;
  const end = Date.now() + durationMs;
  await Promise.all(
    Array.from({ length: concurrency }, async (_, i) => {
      while (Date.now() < end) {
        const t = performance.now();
        const res = await fetch(`${base}/`, { headers: { "x-forwarded-for": `10.1.${i}.1` } }).catch(
          () => null,
        );
        if (!res || !res.ok) errors += 1;
        else await res.text();
        latencies.push(performance.now() - t);
      }
    }),
  );
  return {
    requests: latencies.length,
    rps: Math.round(latencies.length / (durationMs / 1000)),
    p50: Math.round(pct(latencies, 50)),
    p95: Math.round(pct(latencies, 95)),
    p99: Math.round(pct(latencies, 99)),
    errors,
  };
}

async function checkout(browser: Browser, ip: string): Promise<{ ok: boolean; ms: number; detail?: string }> {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
  const page = await context.newPage();
  const t = performance.now();
  try {
    await page.goto(base);
    await page.getByRole("button", { name: "Tout refuser" }).click();
    await page.locator('label:has-text("M — 60")').click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page
      .getByRole("link", { name: /^Panier, / })
      .filter({ hasText: "(1)" })
      .waitFor({ timeout: 20_000 });
    await page.goto(`${base}/panier`);
    await page.getByRole("checkbox", { name: /conditions générales/ }).check();
    await page.getByRole("button", { name: "Commander avec obligation de paiement" }).click();
    await page.waitForURL(/\/pay\/cs_test_mock/, { timeout: 30_000 });
    return { ok: true, ms: performance.now() - t };
  } catch (error) {
    const message = await page
      .locator('p[aria-live="polite"]')
      .last()
      .textContent()
      .catch(() => "");
    return {
      ok: false,
      ms: performance.now() - t,
      detail: message || (error as Error).message.split("\n")[0],
    };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();

console.log("1. Page produit : 50 visiteurs simultanés pendant 15 s");
console.log(await pageLoad(50, 15_000));

console.log("2. 30 commandes simultanées (30 clients différents)");
const results = await Promise.all(Array.from({ length: 30 }, (_, i) => checkout(browser, `10.2.${i}.1`)));
const ok = results.filter((r) => r.ok);
console.log({
  succes: ok.length,
  echecs: results.length - ok.length,
  p50_ms: ok.length
    ? Math.round(
        pct(
          ok.map((r) => r.ms),
          50,
        ),
      )
    : null,
  p95_ms: ok.length
    ? Math.round(
        pct(
          ok.map((r) => r.ms),
          95,
        ),
      )
    : null,
  details: results
    .filter((r) => !r.ok)
    .map((r) => r.detail)
    .slice(0, 3),
});

console.log("3. Un même client qui enchaîne 12 tentatives de paiement");
const sameIp: boolean[] = [];
for (let i = 0; i < 12; i++) sameIp.push((await checkout(browser, "10.3.0.1")).ok);
console.log({ acceptees: sameIp.filter(Boolean).length, bloquees: sameIp.filter((v) => !v).length });

await browser.close();
