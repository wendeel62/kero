// Teste A-02: CEP inexistente não deve resolver para endereço falso
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
const respostas = [];
page.on("response", (r) => {
  if (r.url().includes("/api/geo/geocode")) {
    r.text().then((t) => {
      respostas.push(`${r.status()} -> ${t.slice(0, 200)}`);
    }).catch(() => {});
  }
});
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(`CONSOLE ${m.text().slice(0, 200)}`); });

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

// CEP inválido
await page.fill('input[placeholder="00000-000"]', "99999999");
await page.waitForTimeout(1500);

// fecha qualquer dropdown de autocomplete pressionando Escape
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// número
await page.fill('input[placeholder="Número"]', "100");
await page.waitForTimeout(500);

// clica buscar endereço no mapa
await page.locator(".btn-mapa").first().click();
await page.waitForTimeout(8000);

const texto = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ");
console.log("respostas da API geocode:");
for (const r of respostas) console.log("  ", r);
const temErro = /não encontramos|Não encontramos|erro|inválido|invalido/i.test(texto);
const temAvisoAproximado = /aproximado|região do CEP|arraste o pino/i.test(texto);
console.log(`tem msg de erro/não encontrado: ${temErro}`);
console.log(`tem aviso aproximado/CEP: ${temAvisoAproximado}`);
console.log(`texto relevante: ${texto.match(/.{0,80}(CEP|endereço|não encontramos|aproximado|Arraste).{0,80}/gi)?.join(" || ") || "(nenhum)"}`);

if (temErro || temAvisoAproximado) {
  console.log("RESULTADO: A-02 CORRIGIDO - CEP inválido não resolve para endereço falso");
} else {
  console.log("RESULTADO: A-02 AINDA QUEBRADO - pode ter resolvido para endereço falso");
}

await page.screenshot({ path: "qa-screenshots/test-a02-cep.png", fullPage: true, scale: "css" });
await browser.close();
