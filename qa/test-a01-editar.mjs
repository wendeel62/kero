// Teste A-01: Editar item da sacola não deve ficar travado (modal não sobreposto pela sacola)
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(`CONSOLE ${m.text().slice(0, 200)}`); });
page.on("pageerror", (e) => erros.push(`PAGEERROR ${String(e).slice(0, 200)}`));

await page.goto("http://localhost:3000/pizzariadokbc", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
// fecha cookie banner
await page.evaluate(() => { const b = [...document.querySelectorAll('[data-testid="cookie-banner"] button')].find(x => /recusar/i.test(x.innerText)); b?.click(); });
await page.waitForTimeout(600);

// adiciona item
await page.locator('button[aria-label="Adicionar x-salada"]').click();
await page.waitForTimeout(1200);
await page.locator('.pdetail-option:has-text("Mussarela") input').check();
await page.waitForTimeout(400);
await page.locator(".pdetail-cta").click();
await page.waitForTimeout(900);

// abre sacola
await page.locator(".cartbar").click();
await page.waitForTimeout(900);

// clica Editar
await page.locator('[aria-label="Sacola"] .cartitem-edit').click();
await page.waitForTimeout(1200);

// verifica se o modal de edição está visível e o CTA é clicável
const cta = page.locator(".pdetail-cta");
const ctaVisivel = await cta.isVisible();
const ctaEnabled = await cta.isEnabled();
const modalAberto = await page.evaluate(() => !!document.querySelector(".pdetail-dialog"));
const sacolaAindaAberta = await page.evaluate(() => !!document.querySelector('[aria-label="Sacola"]'));

console.log(`modal aberto: ${modalAberto}`);
console.log(`sacola ainda aberta: ${sacolaAindaAberta}`);
console.log(`CTA visível: ${ctaVisivel}`);
console.log(`CTA enabled: ${ctaEnabled}`);
console.log(`erros: ${erros.length ? erros.join(" | ") : "nenhum"}`);

if (modalAberto && ctaVisivel && ctaEnabled && !sacolaAindaAberta) {
  console.log("RESULTADO: A-01 CORRIGIDO - modal de edição abre sobre a sacola e CTA funciona");
} else {
  console.log("RESULTADO: A-01 AINDA QUEBRADO");
}

// tenta clicar no CTA (deve funcionar agora)
try {
  await cta.click({ timeout: 5000 });
  console.log("CTA clicável com sucesso");
} catch (e) {
  console.log("CTA não clicável:", e.message.slice(0, 100));
}

await page.screenshot({ path: "qa-screenshots/test-a01-editar.png", fullPage: true, scale: "css" });
await browser.close();
