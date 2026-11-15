// 4c) Admin: detalhe do pedido, impressão, cardápio (CRUD real), config, whatsapp, entregas.
import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };
const net = [];
const ORDER_ID = "a673aec4-8681-4f6c-aef8-965a8bbc7c13"; // QA Playwright (pickup, R$30)

async function open(url, vp = "desktop") {
  const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS[vp], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") net.push(`CONSOLE ${m.text().slice(0, 220)}`); });
  p.on("pageerror", (e) => net.push(`PAGEERROR ${String(e).slice(0, 220)}`));
  p.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
  await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 150) break; await p.waitForTimeout(400); }
  await p.waitForTimeout(2000);
  return { c, p };
}
const txt = async (p) => (await p.evaluate(() => document.body?.innerText ?? "")).replace(/\n+/g, " | ");

// ---- detalhe do pedido (URL direta) ----
{
  const { c, p } = await open(`/painel/pedidos/${ORDER_ID}`);
  say(`\n=== DETALHE DO PEDIDO ===\n${(await txt(p)).slice(0, 1400)}`);
  const b = await p.evaluate(() => [...document.querySelectorAll("button,a[href]")].map(x => (x.innerText || x.getAttribute("aria-label") || x.getAttribute("href") || "?").trim().replace(/\n/g, "/").slice(0, 34)));
  say(`[botões/links] ${JSON.stringify([...new Set(b)])}`);
  const ov = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  say(`[overflow] ${JSON.stringify(ov)}`);
  await p.screenshot({ path: "qa-screenshots/adm-pedido-detalhe.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
}
// ---- impressão: testado em qa/print.mjs ----
// ---- cardápio CRUD ----
{
  const { c, p } = await open("/painel/cardapio");
  say(`\n=== CARDÁPIO ===\n${(await txt(p)).slice(0, 600)}`);
  for (const tab of ["Produtos", "Complementos", "Combos"]) {
    await p.getByRole("tab", { name: new RegExp(tab) }).click();
    await p.waitForTimeout(2500);
    say(`[aba ${tab}] ${(await txt(p)).slice(150, 700)}`);
    await p.screenshot({ path: `qa-screenshots/adm-cardapio-${tab.toLowerCase()}.png`, fullPage: true, scale: "css" });
  }
  await p.getByRole("tab", { name: /Categorias/ }).click();
  await p.waitForTimeout(2000);

  // CRIAR categoria
  await p.getByRole("button", { name: /Nova Categoria/i }).click();
  await p.waitForTimeout(1500);
  say(`\n[modal nova categoria] ${(await txt(p)).slice(-500)}`);
  const campos = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")].map(i => ({ tag: i.tagName, type: i.type, ph: i.placeholder, label: i.labels?.[0]?.innerText?.trim() ?? null, id: i.id, name: i.name, required: i.required })));
  say(`[campos] ${JSON.stringify(campos)}`);
  await p.screenshot({ path: "qa-screenshots/adm-cardapio-nova-categoria.png", fullPage: true, scale: "css" });
  // preenche e salva
  const nome = p.locator("input[type='text']").first();
  await nome.fill("QA Categoria Teste");
  await p.waitForTimeout(300);
  const salvar = p.getByRole("button", { name: /Salvar|Criar/i }).first();
  say(`[botão salvar] ${await salvar.count()} "${await salvar.innerText().catch(() => "-")}"`);
  await salvar.click();
  await p.waitForTimeout(4000);
  say(`[após criar] ${(await txt(p)).slice(200, 700)}`);
  await p.screenshot({ path: "qa-screenshots/adm-cardapio-categoria-criada.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
}
// ---- config (abas) ----
{
  const { c, p } = await open("/painel/configuracoes");
  say(`\n=== CONFIG ===\n${(await txt(p)).slice(0, 1500)}`);
  const abas = await p.evaluate(() => [...document.querySelectorAll("button")].map(b => (b.innerText || "").trim().replace(/\n/g, "/")).filter(Boolean));
  say(`[abas] ${JSON.stringify([...new Set(abas)].slice(0, 40))}`);
  await p.screenshot({ path: "qa-screenshots/adm-config-full.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
}
// ---- whatsapp ----
{
  const { c, p } = await open("/painel/whatsapp");
  say(`\n=== WHATSAPP ===\n${(await txt(p)).slice(0, 1000)}`);
  await p.screenshot({ path: "qa-screenshots/adm-whatsapp-full.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
}
// ---- entregas ----
{
  const { c, p } = await open("/painel/entregas");
  say(`\n=== ENTREGAS ===\n${(await txt(p)).slice(0, 1000)}`);
  await p.screenshot({ path: "qa-screenshots/adm-entregas-full.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
}
fs.writeFileSync("qa/out/admin-interactions2.txt", log.join("\n"));
say(`\n=== rede/console ===\n${net.join("\n") || "(sem erros)"}`);
await browser.close();
