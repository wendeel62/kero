import { launch, visit, report, attach, BASE } from "./qa-audit.mjs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', "pizzaria123@gmail.com");
await page.fill('input[type="password"]', "LojistaTest2026!");
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);
console.log("LOGIN -> ", page.url());
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1200));
await page.screenshot({ path: "qa-screenshots/lojista-hoje-desktop.png", fullPage: true, scale: "css" });
await page.close();

const routes = [
  ["/painel", "adm-hoje"],
  ["/painel/pedidos", "adm-pedidos"],
  ["/painel/pdv", "adm-pdv"],
  ["/painel/entregas", "adm-entregas"],
  ["/painel/cardapio", "adm-cardapio"],
  ["/painel/clientes", "adm-clientes"],
  ["/painel/configuracoes", "adm-config"],
  ["/painel/whatsapp", "adm-whatsapp"],
  ["/painel/financeiro", "adm-financeiro"],
];
const rows = [];
for (const [url, label] of routes) {
  const r = await visit(ctx, url, label, { viewport: "desktop", wait: 3000 });
  // extra: buttons/selects/tables
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  r.info = r.info || {};
  r.info.buttons = await p.evaluate(() => Array.from(document.querySelectorAll("button")).map((b) => (b.innerText || b.getAttribute("aria-label") || b.title || "?").trim().replace(/\n/g, "/").slice(0, 40)));
  r.info.selects = await p.evaluate(() => Array.from(document.querySelectorAll("select")).map((s) => `${s.name || s.id}: ${Array.from(s.options).map((o) => o.text).join("|")}`));
  r.info.tables = await p.evaluate(() => Array.from(document.querySelectorAll("table")).map((t) => t.innerText.replace(/\n+/g, " / ").slice(0, 600)));
  r.info.rows = await p.evaluate(() => Array.from(document.querySelectorAll("[role=row], tr, li")).length);
  await p.close();
  rows.push(r);
}
report(rows);
await browser.close();
