// 5) Admin: cardápio CRUD + config + whatsapp + entregas + auditoria de labels.
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
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") net.push(`CONSOLE ${m.text().slice(0, 220)}`); });
  p.on("pageerror", (e) => net.push(`PAGEERROR ${String(e).slice(0, 220)}`));
  p.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
  await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 90000 });
  for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
  await p.waitForTimeout(1500);
  return { c, p };
}
const txt = async (p) => (await p.evaluate(() => document.body?.innerText ?? "")).replace(/\n+/g, " | ");
const labelAudit = async (p, label) => {
  const bad = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")].filter(i => {
    if (i.type === "hidden") return false;
    const vis = i.getBoundingClientRect().width > 0 && getComputedStyle(i).display !== "none";
    if (!vis) return false;
    return !(i.labels?.length || i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.getAttribute("title") || i.getAttribute("placeholder"));
  }).map(i => ({ tag: i.tagName, type: i.type, name: i.name || null, id: i.id || null })));
  say(`[labels ${label}] sem nome acessível: ${bad.length ? JSON.stringify(bad) : "nenhum"}`);
};

async function section(name, fn) {
  say(`\n===== ${name} =====`);
  try { await fn(); } catch (e) { say(`  ERRO: ${e.message.split("\n")[0]}`); }
}

// ---------- 1. cardápio: criar categoria + produto + editar + excluir ----------
await section("CARDÁPIO CRUD", async () => {
  const { c, p } = await open("/painel/cardapio");
  await labelAudit(p, "cardápio");
  await p.getByRole("button", { name: /Nova Categoria/i }).click();
  await p.waitForTimeout(1500);
  const boxes = p.getByRole("textbox");
  say(`[modal] textboxes=${await boxes.count()}`);
  await boxes.first().fill("QA Categoria Teste");
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /^Salvar$/ }).click();
  await p.waitForTimeout(4000);
  const t = await txt(p);
  say(`[após criar categoria] contém "QA Categoria Teste"? ${t.includes("QA Categoria Teste")}`);
  say(`  ${t.slice(t.indexOf("Categorias"), t.indexOf("Categorias") + 400)}`);
  await p.screenshot({ path: "qa-screenshots/adm-cardapio-categoria-criada.png", fullPage: true, scale: "css" });

  // produto
  await p.getByRole("tab", { name: /Produtos/ }).click();
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: /Novo Produto/i }).click();
  await p.waitForTimeout(1500);
  say(`[modal produto] ${(await txt(p)).slice(-700)}`);
  const fields = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")].filter(i => i.getBoundingClientRect().width > 0).map(i => ({ tag: i.tagName, type: i.type, ph: i.placeholder, label: i.labels?.[0]?.innerText?.trim() ?? null, aria: i.getAttribute("aria-label") })));
  say(`[modal produto campos] ${JSON.stringify(fields)}`);
  await p.screenshot({ path: "qa-screenshots/adm-cardapio-novo-produto.png", fullPage: true, scale: "css" });
  // preencher e salvar
  const tbs = p.getByRole("textbox");
  const n = await tbs.count();
  say(`[modal produto] textboxes=${n}`);
  for (let i = 0; i < n; i++) {
    const el = tbs.nth(i);
    const ph = await el.getAttribute("placeholder");
    const type = await el.getAttribute("type");
    if (type === "file") continue;
    if (ph && /pre[çc]o/i.test(ph)) await el.fill("12,50");
    else if (!ph || ph.length === 0) await el.fill(`campo ${i}`);
  }
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /^Salvar$/ }).click().catch(() => {});
  await p.waitForTimeout(4000);
  say(`[após salvar produto] ${(await txt(p)).slice(200, 800)}`);
  await p.screenshot({ path: "qa-screenshots/adm-cardapio-produto-salvo.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
});

// ---------- 2. config ----------
await section("CONFIGURAÇÕES", async () => {
  const { c, p } = await open("/painel/configuracoes");
  say((await txt(p)).slice(0, 1500));
  await labelAudit(p, "config");
  const abas = await p.evaluate(() => [...document.querySelectorAll("button")].map(b => (b.innerText || "").trim().replace(/\n/g, "/")).filter(Boolean));
  say(`[abas] ${JSON.stringify([...new Set(abas)].slice(0, 40))}`);
  await p.screenshot({ path: "qa-screenshots/adm-config-full.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
});

// ---------- 3. whatsapp ----------
await section("WHATSAPP", async () => {
  const { c, p } = await open("/painel/whatsapp");
  say((await txt(p)).slice(0, 1200));
  await p.screenshot({ path: "qa-screenshots/adm-whatsapp-full.png", fullPage: true, scale: "css" });
  const chats = await p.evaluate(() => [...document.querySelectorAll("li,button,div[role='button']")].map(e => (e.innerText || "").trim().replace(/\n+/g, " | ").slice(0, 60)).filter(t => t.length > 4).slice(0, 20));
  say(`[elementos clicáveis] ${JSON.stringify(chats)}`);
  await p.close(); await c.close();
});

// ---------- 4. entregas ----------
await section("ENTREGAS", async () => {
  const { c, p } = await open("/painel/entregas");
  say((await txt(p)).slice(0, 1200));
  await p.screenshot({ path: "qa-screenshots/adm-entregas-full.png", fullPage: true, scale: "css" });
  const btns = await p.evaluate(() => [...document.querySelectorAll("button")].map(b => (b.innerText || b.getAttribute("aria-label") || "?").trim().replace(/\n/g, "/")).filter(Boolean));
  say(`[botões] ${JSON.stringify([...new Set(btns)].slice(0, 30))}`);
  await p.close(); await c.close();
});

// ---------- 5. clientes / financeiro / pdv ----------
for (const [url, label] of [["/painel/clientes", "clientes"], ["/painel/financeiro", "financeiro"], ["/painel/pdv", "pdv"]]) {
  await section(`PAINEL ${label.toUpperCase()}`, async () => {
    const { c, p } = await open(url);
    say((await txt(p)).slice(0, 1200));
    await labelAudit(p, label);
    await p.screenshot({ path: `qa-screenshots/adm-${label}-full.png`, fullPage: true, scale: "css" });
    await p.close(); await c.close();
  });
}

// ---------- 6. motoboy ----------
await section("MOTOboy", async () => {
  const { c, p } = await open("/motoboy/login");
  say((await txt(p)).slice(0, 500));
  await labelAudit(p, "motoboy login");
  await p.screenshot({ path: "qa-screenshots/motoboy-login-full.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
});

// ---------- 7. admin (operador) ----------
await section("ADMIN (operador)", async () => {
  const { c, p } = await open("/admin");
  say((await txt(p)).slice(0, 1200));
  await p.screenshot({ path: "qa-screenshots/adm-admin-full.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
});

fs.writeFileSync("qa/out/admin-sections.txt", log.join("\n"));
say(`\n=== rede/console ===\n${net.join("\n") || "(sem erros)"}`);
await browser.close();
