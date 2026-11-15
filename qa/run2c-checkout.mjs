// 2c) Checkout: carrinho vazio, máscara de CEP, telefone/troco inválidos,
// pedido completo (retirada), duplo clique, página de acompanhamento.
import { launch, BASE, SLUG, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };
const net = [];
const page = await ctx.newPage();
await page.setViewportSize(VIEWPORTS.desktop);
page.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
page.on("console", (m) => { if (m.type() === "error") net.push(`CONSOLE ${m.text().slice(0, 160)}`); });
page.on("pageerror", (e) => net.push(`PAGEERROR ${String(e).slice(0, 200)}`));

const txt = async () => (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ");

// ---- 1. carrinho VAZIO → finalizar habilitado? ----
await page.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Aceitar" }).click().catch(() => {});
await page.locator('button[aria-label="Adicionar x-salada"]').click();
await page.waitForTimeout(900);
await page.locator('.pdetail-option:has-text("Mussarela") input').check();
await page.locator(".pdetail-cta").click();
await page.waitForTimeout(800);
await page.locator(".cartbar").click();
await page.waitForTimeout(700);
for (let i = 0; i < 6; i++) {
  const b = page.locator('[aria-label="Sacola"] button[aria-label="Diminuir quantidade"]').first();
  if (!(await b.count())) break;
  await b.click(); await page.waitForTimeout(300);
}
await page.waitForTimeout(400);
const btnVazio = page.locator(".btn-finalizar-carrinho");
say(`\n[carrinho vazio] "Finalizar pedido" disabled = ${await btnVazio.isDisabled()} | texto sacola = ${(await txt()).slice(0, 160)}`);
await btnVazio.click();
await page.waitForTimeout(2000);
say(`[carrinho vazio → checkout] url = ${page.url().replace(BASE, "")} | texto = ${(await txt()).slice(0, 400)}`);
await page.screenshot({ path: "qa-screenshots/pub-checkout-carrinho-vazio.png", fullPage: true, scale: "css" });

// ---- 2. máscara de CEP / telefone ----
await page.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
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
await page.getByRole("radio", { name: /Entrega/ }).click();
await page.waitForTimeout(600);

// CEP: digita com máscara
await page.fill('input[placeholder="00000-000"]', "69000-000");
await page.waitForTimeout(600);
say(`[CEP] valor exibido após digitar "69000-000" = ${JSON.stringify(await page.inputValue('input[placeholder="00000-000"]'))}`);
// telefone com máscara
await page.fill('input[placeholder="(11) 99999-9999"]', "(92) 99153-2662");
await page.waitForTimeout(400);
say(`[telefone] valor exibido após digitar "(92) 99153-2662" = ${JSON.stringify(await page.inputValue('input[placeholder="(11) 99999-9999"]'))}`);

// CEP inexistente via botão "Buscar endereço no mapa"
await page.fill('input[placeholder="00000-000"]', "99999999");
await page.waitForTimeout(500);
await page.locator(".btn-mapa").first().click();
await page.waitForTimeout(6000);
say(`[CEP inexistente + botão] texto = ${(await txt()).match(/.{0,70}(CEP|endereço|erro|Erro).{0,70}/gi)?.join(" || ") || "(nenhuma msg)"}`);
await page.screenshot({ path: "qa-screenshots/pub-checkout-cep-invalido-botao.png", fullPage: true, scale: "css" });

// ---- 3. telefone inválido → mensagem crua ----
await page.fill('input[placeholder="Seu nome completo"]', "QA Playwright");
await page.fill('input[placeholder="(11) 99999-9999"]', "1");
await page.fill('input[placeholder="Rua, número..."]', "Rua das Flores, 100");
await page.fill('input[placeholder="Número"]', "100");
await page.waitForTimeout(6000);
const foneErr = await page.evaluate(() => document.querySelector(".erro-quote")?.textContent ?? null);
say(`[telefone inválido] erro exibido = ${JSON.stringify(foneErr)}`);
const st = await page.evaluate(() => ({ bairro: [...document.querySelectorAll("select")].map(s => s.options.length ? s.options[s.selectedIndex].text : ""), opts: [...document.querySelectorAll("select")].map(s => [...s.options].map(o => o.text)) }));
say(`[bairro] select = ${JSON.stringify(st)}`);
await page.screenshot({ path: "qa-screenshots/pub-checkout-telefone-invalido.png", fullPage: true, scale: "css" });

// ---- 4. retirada completa (sem endereço) + duplo clique ----
await page.getByRole("radio", { name: /Retirada/ }).click();
await page.waitForTimeout(600);
await page.fill('input[placeholder="Seu nome completo"]', "QA Playwright");
await page.fill('input[placeholder="(11) 99999-9999"]', "92991532662");
await page.waitForTimeout(4000);
const erroAntes = await page.evaluate(() => document.querySelector(".erro-quote")?.textContent ?? null);
say(`\n[retirada] erro = ${JSON.stringify(erroAntes)} | total = ${await page.evaluate(() => document.querySelector(".cta-total strong")?.textContent)}`);
say(`[retirada] finalizar disabled = ${await page.locator(".btn-finalizar").isDisabled()}`);

// duplo clique
await page.locator(".btn-finalizar").dblclick({ delay: 60 }).catch((e) => say("  dblclick err:", e.message.slice(0, 80)));
await page.waitForTimeout(7000);
say(`[duplo clique] url = ${page.url().replace(BASE, "")}`);
say(`[duplo clique] texto = ${(await txt()).slice(0, 700)}`);
await page.screenshot({ path: "qa-screenshots/pub-pedido-confirmacao.png", fullPage: true, scale: "css" });

// ---- 5. página de acompanhamento ----
const token = "e98ab2b6-412b-4d05-bb7d-0730e33b4423";
await page.goto(`${BASE}/${SLUG}/pedido/${token}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
say(`\n[acompanhamento] texto = ${(await txt()).slice(0, 700)}`);
await page.screenshot({ path: "qa-screenshots/pub-acompanhamento.png", fullPage: true, scale: "css" });
await page.goto(`${BASE}/${SLUG}/pedido/token-inexistente-123`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
say(`[acompanhamento token inválido] texto = ${(await txt()).slice(0, 400)}`);
await page.screenshot({ path: "qa-screenshots/pub-acompanhamento-404.png", fullPage: true, scale: "css" });

fs.writeFileSync("qa/out/pub-checkout.txt", log.join("\n"));
say(`\n[rede/console]\n${net.join("\n") || "(sem erros)"}`);
await browser.close();
