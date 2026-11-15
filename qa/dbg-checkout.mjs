import { launch, BASE, SLUG, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const page = await ctx.newPage();
await page.setViewportSize(VIEWPORTS.desktop);
page.on("console", (m) => { if (m.type() !== "info" && m.type() !== "log") console.log(`CONSOLE[${m.type()}] ${m.text().slice(0, 500)}`); });
page.on("pageerror", (e) => console.log(`PAGEERROR ${String(e).slice(0, 800)}`));
page.on("response", (r) => { if (r.url().includes("/api/")) console.log(`API ${r.status()} ${r.request().method()} ${r.url().slice(0, 120)}`); });

await page.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Aceitar" }).click().catch(() => {});
await page.locator('button[aria-label="Adicionar x-salada"]').click();
await page.waitForTimeout(900);
await page.locator('.pdetail-option:has-text("Mussarela") input').check();
await page.locator('button[aria-label="Aumentar quantidade"]').first().click();
await page.locator('button[aria-label="Aumentar quantidade"]').first().click();
await page.locator(".pdetail-cta").click();
await page.waitForTimeout(800);
await page.locator(".cartbar").click();
await page.waitForTimeout(700);
await page.locator(".btn-finalizar-carrinho").click();
await page.waitForTimeout(1500);
await page.getByRole("radio", { name: /Retirada/ }).click();
await page.waitForTimeout(500);
await page.fill('input[placeholder="Seu nome completo"]', "QA Playwright 2");
await page.fill('input[placeholder="(11) 99999-9999"]', "92991532662");
await page.waitForTimeout(5000);
console.log("finalizar disabled?", await page.locator(".btn-finalizar").isDisabled());
console.log("total:", await page.evaluate(() => document.querySelector(".cta-total strong")?.textContent));

console.log("--- clicando finalizar ---");
await page.locator(".btn-finalizar").click();
for (const t of [1000, 2000, 4000, 8000, 12000]) {
  await page.waitForTimeout(t === 1000 ? 1000 : t - (t === 2000 ? 1000 : t === 4000 ? 2000 : t === 8000 ? 4000 : 8000));
  console.log(`t=${t}ms url=${page.url().replace(BASE, "")} | botao="${await page.evaluate(() => document.querySelector(".btn-finalizar")?.innerText)}" | erro=${await page.evaluate(() => document.querySelector(".erro-quote")?.textContent ?? "-")}`);
}
await page.screenshot({ path: "qa-screenshots/dbg-checkout-submit.png", fullPage: true, scale: "css" });
await browser.close();
