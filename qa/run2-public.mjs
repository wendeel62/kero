// 2) Área pública: vitrine, busca, carrinho, checkout (validação, CEP, geo, duplo clique).
import { launch, visit, BASE, SLUG, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };
const net = [];

const page = await ctx.newPage();
await page.setViewportSize(VIEWPORTS.desktop);
page.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${r.url().slice(0, 140)}`); });
page.on("console", (m) => { if (m.type() === "error") net.push(`CONSOLE ${m.text().slice(0, 200)}`); });
page.on("pageerror", (e) => net.push(`PAGEERROR ${String(e).slice(0, 200)}`));

await page.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Aceitar" }).click().catch(() => {});
await page.waitForTimeout(500);

// ---- abrir produto x-salada (grupo obrigatório "Sabores", max 2, min 1) ----
await page.locator('button[aria-label="Adicionar x-salada"]').click();
await page.waitForTimeout(1200);
say(`[grupo] texto: ${await page.evaluate(() => document.querySelector(".pdetail-group-sub")?.textContent)}`);
say(`[grupo] inputs: ${await page.evaluate(() => [...document.querySelectorAll(".pdetail-group input")].map(i => i.type).join(","))}`);
say(`[CTA] disabled com 0 escolhidas = ${await page.locator(".pdetail-cta").isDisabled()}`);

// seleciona 1 (min=1) → CTA habilita?
await page.locator('.pdetail-option:has-text("Mussarela") input').check();
await page.waitForTimeout(500);
say(`[CTA] disabled com 1 escolhida (min_choices=1) = ${await page.locator(".pdetail-cta").isDisabled()}`);
say(`[preço modal] ${await page.evaluate(() => document.querySelector(".pdetail-price")?.textContent)}`);

// 2ª escolha
await page.locator('.pdetail-option:has-text("Portuguesa") input').check();
await page.waitForTimeout(400);
say(`[grupo 2 marcadas] ${await page.evaluate(() => [...document.querySelectorAll(".pdetail-option input")].map(i => i.checked).join(","))}`);
// desmarcar a 1ª (deve permitir, min=1)
await page.locator('.pdetail-option:has-text("Mussarela") input').uncheck();
await page.waitForTimeout(400);
say(`[CTA] disabled após desmarcar 1 de 2 (restou 1) = ${await page.locator(".pdetail-cta").isDisabled()}`);
await page.locator('.pdetail-option:has-text("Mussarela") input').check();
await page.waitForTimeout(300);

// qtd 3
await page.locator('button[aria-label="Aumentar quantidade"]').first().click();
await page.locator('button[aria-label="Aumentar quantidade"]').first().click();
await page.waitForTimeout(400);
say(`[modal] stepper = ${await page.evaluate(() => document.querySelector(".stepper strong")?.textContent)}`);
say(`[modal] CTA preço = ${await page.evaluate(() => document.querySelector(".pdetail-cta")?.innerText.replace(/\n/g, " "))}`);
await page.screenshot({ path: "qa-screenshots/pub-produto-modal.png", fullPage: true, scale: "css" });

await page.locator(".pdetail-cta").click();
await page.waitForTimeout(1200);
say(`[carrinho] cartbar = ${JSON.stringify(await page.evaluate(() => document.querySelector(".cartbar")?.innerText.replace(/\n/g, " | ")))}`);
await page.screenshot({ path: "qa-screenshots/pub-add-ao-carrinho.png", scale: "css" });

// ---- sacola ----
await page.locator(".cartbar").click();
await page.waitForTimeout(1000);
const sacolaTxt = async () => (await page.evaluate(() => document.querySelector('[aria-label="Sacola"]')?.innerText ?? "(sem sacola)")).replace(/\n+/g, " | ");
say(`[sacola] ${await sacolaTxt()}`);
await page.screenshot({ path: "qa-screenshots/pub-sacola.png", fullPage: true, scale: "css" });

// +1 no item
await page.locator('[aria-label="Sacola"] button[aria-label="Aumentar quantidade"]').click();
await page.waitForTimeout(700);
say(`[sacola +1] ${await sacolaTxt()}`);
await page.locator('[aria-label="Sacola"] button[aria-label="Diminuir quantidade"]').click();
await page.waitForTimeout(700);
say(`[sacola -1] ${await sacolaTxt()}`);

// observação
await page.fill('[aria-label="Sacola"] textarea', "sem cebola, capricha no orégano");
await page.waitForTimeout(500);

// edição de item — BUG: modal de edição abre ATRÁS da sacola (z-index 20 igual, sacola depois no DOM)
await page.locator('[aria-label="Sacola"] .cartitem-edit').click();
await page.waitForTimeout(1000);
const editDiag = await page.evaluate(() => {
  const cta = document.querySelector(".pdetail-cta");
  const r = cta.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { modalAberto: !!document.querySelector(".pdetail-dialog"), ctaCobertoPor: top ? `${top.tagName}.${(top.className||"").toString().slice(0,30)}` : null, ctaVisivel: r.width > 0 };
});
say(`[editar] ${JSON.stringify(editDiag)} -> CTA inalcançável (ver bug-editar-item-zindex.png)`);
// fecha o modal de edição pelo ✕ (único ponto clicável)
await page.locator('.pdetail-dialog .sheet-close').click({ force: true }).catch(() => {});
await page.waitForTimeout(700);
say(`[editar] modal fechado? ${await page.evaluate(() => !document.querySelector(".pdetail-dialog"))}`);

// fechar overlay clicando fora
await page.mouse.click(15, 15);
await page.waitForTimeout(800);
say(`[modal fecha fora] sacola aberta? ${await page.evaluate(() => !!document.querySelector('[aria-label="Sacola"]'))}`);

// esvaziar (qtd até 0)
await page.locator(".cartbar").click();
await page.waitForTimeout(700);
for (let i = 0; i < 6; i++) {
  const b = page.locator('[aria-label="Sacola"] button[aria-label="Diminuir quantidade"]').first();
  if (!(await b.count())) break;
  await b.click();
  await page.waitForTimeout(350);
}
await page.waitForTimeout(500);
say(`[sacola esvaziada] ${await sacolaTxt()}`);
await page.screenshot({ path: "qa-screenshots/pub-sacola-vazia.png", fullPage: true, scale: "css" });
say(`[sacola esvaziada] cartbar visível? ${await page.evaluate(() => !!document.querySelector(".cartbar"))}`);

// ---- checkout ----
await page.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.locator('button[aria-label="Adicionar x-salada"]').click();
await page.waitForTimeout(1000);
await page.locator('.pdetail-option:has-text("Mussarela") input').check();
await page.waitForTimeout(300);
await page.locator(".pdetail-cta").click();
await page.waitForTimeout(900);
await page.locator(".cartbar").click();
await page.waitForTimeout(800);
await page.locator(".btn-finalizar-carrinho").click();
await page.waitForTimeout(1800);
await page.screenshot({ path: "qa-screenshots/pub-checkout-etapa1.png", fullPage: true, scale: "css" });
say(`\n[checkout etapa1] ${(await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 500)}`);

// tipo: retirada e entrega
await page.getByRole("radio", { name: /Retirada/ }).click();
await page.waitForTimeout(900);
say(`[tipo retirada] marcado=${await page.evaluate(() => document.querySelector('[role="radio"][aria-checked="true"]')?.innerText)} | campos endereco visiveis=${await page.evaluate(() => !!document.querySelector('input[placeholder="Rua, número..."]'))}`);
await page.getByRole("radio", { name: /Entrega/ }).click();
await page.waitForTimeout(900);
say(`[tipo entrega] marcado=${await page.evaluate(() => document.querySelector('[role="radio"][aria-checked="true"]')?.innerText)}`);

const submit = page.locator(".btn-finalizar");
say(`[checkout] finalizar disabled = ${await submit.isDisabled()}`);
await submit.click({ force: true }).catch((e) => say("  submit:", e.message.slice(0, 90)));
await page.waitForTimeout(1200);
say(`[checkout vazio] msgs de erro: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(":invalid")].map(i => i.validationMessage).slice(0, 6)))}`);
await page.screenshot({ path: "qa-screenshots/pub-checkout-vazio.png", fullPage: true, scale: "css" });

// dados inválidos
await page.fill('input[placeholder="Seu nome completo"]', "a");
await page.fill('input[placeholder="(11) 99999-9999"]', "123");
await page.fill('input[placeholder="00000-000"]', "99999999");
await page.fill('input[placeholder="Número"]', "abc");
await page.waitForTimeout(900);
say(`[checkout lixo] finalizar disabled = ${await submit.isDisabled()}`);
await page.screenshot({ path: "qa-screenshots/pub-checkout-dados-invalidos.png", fullPage: true, scale: "css" });

// CEP inexistente
await page.fill('input[placeholder="00000-000"]', "99999999");
await page.waitForTimeout(5000);
const cepTxt = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ");
say(`[CEP 99999-999] ${cepTxt.slice(0, 800)}`);
await page.screenshot({ path: "qa-screenshots/pub-checkout-cep-inexistente.png", fullPage: true, scale: "css" });

// CEP válido do dataset (manaus/AM) — 69000-000? usa testes do repo
const cepTeste = await page.evaluate(() => (window.__cep ?? null));
say(`[CEP] teste interno: ${cepTeste}`);

// geolocalização negada
await page.locator(".btn-mapa").nth(1).click().catch((e) => say("geo btn:", e.message.slice(0, 60)));
await page.waitForTimeout(5000);
const geoTxt = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ");
say(`[geo negada] ${geoTxt.match(/.{0,80}(localiza|GPS|permiss|erro).{0,80}/gi)?.join(" || ") || "(sem msg)"}`);
await page.screenshot({ path: "qa-screenshots/pub-checkout-geo-negada.png", fullPage: true, scale: "css" });

fs.writeFileSync("qa/out/pub-interactions.txt", log.join("\n"));
say(`\n[rede/console]\n${net.join("\n") || "(sem erros)"}`);
await page.close();
await browser.close();
