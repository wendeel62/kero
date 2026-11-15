// Teste A-02 específico: botão "Finalizar pedido" deve ficar DESABILITADO com CEP inválido
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto("http://localhost:3000/pizzariadokbc", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('[data-testid="cookie-banner"] button')].find(x => /recusar/i.test(x.innerText)); b?.click(); });
await page.waitForTimeout(600);

// adiciona item e vai para checkout
await page.locator('button[aria-label="Adicionar x-salada"]').click();
await page.waitForTimeout(1200);
await page.locator('.pdetail-option:has-text("Mussarela") input').check();
await page.waitForTimeout(400);
await page.locator(".pdetail-cta").click();
await page.waitForTimeout(900);
await page.locator(".cartbar").click();
await page.waitForTimeout(900);
await page.locator(".btn-finalizar-carrinho").click();
await page.waitForTimeout(2000);

// entrega
await page.getByRole("radio", { name: /Entrega/ }).click();
await page.waitForTimeout(800);

// preenche dados básicos
await page.fill('input[placeholder="Seu nome completo"]', "QA CEP");
await page.fill('input[placeholder="(11) 99999-9999"]', "92991532662");

// rua → fecha autocomplete com Escape
await page.fill('input[placeholder="Rua, número..."]', "Rua Teste");
await page.waitForTimeout(800);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// CEP inválido
await page.fill('input[placeholder="00000-000"]', "99999999");
await page.waitForTimeout(1500);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// número
await page.fill('input[placeholder="Número"]', "100");
await page.waitForTimeout(500);

// clica buscar endereço no mapa
await page.locator(".btn-mapa").first().click();
await page.waitForTimeout(8000);

const btnDisabled = await page.locator(".btn-finalizar").isDisabled();
const texto = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ");
const erro = texto.match(/.{0,60}(erro|não encontramos|aproximado|Arraste).{0,60}/gi);
console.log(`botão finalizar desabilitado: ${btnDisabled}`);
console.log(`erro/aviso na página: ${erro ? erro.join(" | ") : "(nenhum)"}`);
console.log(`texto relevante: ${texto.match(/.{0,80}(CEP|endereço|não encontramos|aproximado|Arraste|Confirme).{0,80}/gi)?.join(" || ") || "(nenhum)"}`);

if (btnDisabled) {
  console.log("RESULTADO: A-02 CORRIGIDO - botão desabilitado com CEP inválido (requer confirmação no mapa)");
} else {
  console.log("RESULTADO: A-02 AINDA QUEBRADO - botão habilitado sem confirmação de endereço");
}

await page.screenshot({ path: "qa-screenshots/test-a02-botao.png", fullPage: true, scale: "css" });
await browser.close();
