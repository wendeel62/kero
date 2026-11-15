// 6) Config em abas, motoboys, caixa, auditoria de labels com modal aberto, isolamento multi-loja.
import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };
const net = [];

async function open(url, vp = "desktop") {
  const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS[vp], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") net.push(`CONSOLE ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => net.push(`PAGEERROR ${String(e).slice(0, 200)}`));
  p.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 130)}`); });
  await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 90000 });
  for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
  await p.waitForTimeout(1500);
  return { c, p };
}
const txt = async (p) => (await p.evaluate(() => document.body?.innerText ?? "")).replace(/\n+/g, " | ");
const sec = async (n, fn) => { say(`\n===== ${n} =====`); try { await fn(); } catch (e) { say(`  ERRO: ${e.message.split("\n")[0]}`); } };

await sec("CONFIG — abas", async () => {
  const { c, p } = await open("/painel/configuracoes");
  for (const tab of ["Horários", "Entrega", "Salão", "Rastreamento", "Conta"]) {
    await p.getByRole("button", { name: tab, exact: true }).click().catch((e) => say(`  [${tab}] ${e.message.split("\n")[0]}`));
    await p.waitForTimeout(2500);
    const t = await txt(p);
    say(`[${tab}] ${t.slice(t.indexOf("configurações") >= 0 ? t.indexOf("configurações") : 0).slice(0, 900)}`);
    await p.screenshot({ path: `qa-screenshots/adm-config-${tab.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}.png`, fullPage: true, scale: "css" });
    const bad = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")].filter(i => {
      if (i.type === "hidden") return false;
      if (!(i.getBoundingClientRect().width > 0)) return false;
      return !(i.labels?.length || i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.getAttribute("title") || i.getAttribute("placeholder"));
    }).map(i => `${i.tagName}[${i.type}]${i.name ? ` name=${i.name}` : ""}`));
    say(`  [labels sem nome] ${bad.length ? JSON.stringify(bad) : "nenhum"}`);
  }
  await p.close(); await c.close();
});

await sec("ENTREGAS — modal novo motoboy", async () => {
  const { c, p } = await open("/painel/entregas");
  await p.getByRole("button", { name: /Novo motoboy/i }).click();
  await p.waitForTimeout(1500);
  say((await txt(p)).slice(-600));
  const f = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")].filter(i => i.getBoundingClientRect().width > 0).map(i => ({ tag: i.tagName, type: i.type, ph: i.placeholder, label: i.labels?.[0]?.innerText?.trim() ?? null, aria: i.getAttribute("aria-label") })));
  say(`[campos] ${JSON.stringify(f)}`);
  await p.screenshot({ path: "qa-screenshots/adm-entregas-modal-motoboy.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
});

await sec("FINANCEIRO — abrir caixa", async () => {
  const { c, p } = await open("/painel/financeiro");
  await p.waitForTimeout(4000);
  const t = await txt(p);
  say(`[financeiro] ${t.slice(0, 700)}`);
  const abrir = p.getByRole("button", { name: /Abrir caixa/i }).first();
  if (await abrir.count()) {
    await abrir.click();
    await p.waitForTimeout(2000);
    say(`[modal abrir caixa] ${(await txt(p)).slice(-500)}`);
    await p.screenshot({ path: "qa-screenshots/adm-financeiro-abrir-caixa.png", fullPage: true, scale: "css" });
    const inputs = await p.evaluate(() => [...document.querySelectorAll("input")].filter(i => i.getBoundingClientRect().width > 0).map(i => ({ type: i.type, ph: i.placeholder, label: i.labels?.[0]?.innerText?.trim() ?? null })));
    say(`[inputs] ${JSON.stringify(inputs)}`);
    // cancela
    await p.getByRole("button", { name: /Cancelar/i }).first().click().catch(() => {});
    await p.waitForTimeout(1000);
  } else say("[sem botão Abrir caixa]");
  await p.close(); await c.close();
});

await sec("ISOLAMENTO MULTI-LOJA (lojista pizzariadokbc)", async () => {
  const outros = [
    ["/painel/pedidos/116062ee-5550-41d2-8f19-5704d34144ca", "pedido da loja-qa-hermes"],
    ["/painel/pedidos/116062ee-5550-41d2-8f19-5704d34144ca/print", "cupom da loja-qa-hermes"],
    ["/painel/pedidos/272d6fbe-6be0-4270-b3f7-7e65bf662769", "pedido de outra loja (id real)"],
    ["/painel/pedidos?id=cda9a418-1995-4c6f-86db-cc112fdd3def", "lista filtrada por store_id"],
  ];
  for (const [url, label] of outros) {
    const { c, p } = await open(url);
    const t = await txt(p);
    say(`[${label}] url=${p.url().replace(BASE, "")}`);
    say(`   ${t.slice(0, 500)}`);
    const alheio = /Teste QA Hermes|Pizzaria QA Hermes/i.test(t);
    say(`   >>> vazou dado de outra loja? ${alheio}`);
    await p.screenshot({ path: `qa-screenshots/multi-loja-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, fullPage: true, scale: "css" });
    await p.close(); await c.close();
  }
  // API direta
  for (const api of ["/api/admin/stores/cda9a418-1995-4c6f-86db-cc112fdd3def", "/api/whatsapp/chats"]) {
    const { c, p } = await open("/painel");
    const r = await p.evaluate(async (u) => { const res = await fetch(u); return `${res.status} ${(await res.text()).slice(0, 220)}`; }, api);
    say(`[API ${api}] ${r}`);
    await p.close(); await c.close();
  }
});

await sec("FIM DE SESSÃO / EXPIRAÇÃO", async () => {
  const { c, p } = await open("/painel");
  // simula sessão expirada: apaga cookies
  await c.clearCookies();
  await p.goto(`${BASE}/painel`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  say(`[sem sessão → /painel] url=${p.url().replace(BASE, "")}`);
  say(`  ${(await txt(p)).slice(0, 300)}`);
  await p.close(); await c.close();
});

fs.writeFileSync("qa/out/admin-sections2.txt", log.join("\n"));
say(`\n=== rede/console ===\n${net.join("\n") || "(sem erros)"}`);
await browser.close();
