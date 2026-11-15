import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
await p.goto(BASE + "/painel", { waitUntil: "domcontentloaded" });
for (let i = 0; i < 30; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/Carregando/.test(t) && t.length > 150) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2000);

// 1) o "+" solto no card de meta
const card = await p.locator("text=Meta de faturamento").first();
await card.screenshot({ path: "qa-screenshots/dbg-meta-faturamento.png" }).catch(() => {});
// elemento exato na posição do "+"
const probe = await p.evaluate(() => {
  const el = document.elementFromPoint(798, 795);
  const card = [...document.querySelectorAll("div")].find((d) => d.innerText?.includes("Meta de faturamento"));
  const els = card ? [...card.querySelectorAll("*")].map((e) => ({ tag: e.tagName, cls: (e.className || "").toString().slice(0, 50), txt: (e.innerText || "").slice(0, 30), rect: e.getBoundingClientRect().toJSON() })) : [];
  return { at: el ? `${el.tagName}.${(el.className||"").toString().slice(0,40)}` : null, els: els.filter(e => e.rect.width > 0 && e.rect.height > 0 && (e.txt === "+" || e.tag === "svg" || e.tag === "path")).slice(0, 20) };
});
console.log("elemento no ponto do '+':", probe.at);
console.log("elementos na área do card:", JSON.stringify(probe.els, null, 1).slice(0, 2500));

// 2) sidebar só com ícones: tem tooltip?
const nav = await p.evaluate(() => {
  const links = [...document.querySelectorAll("aside a, nav a")].slice(0, 12);
  return links.map((a) => ({ href: a.getAttribute("href"), title: a.getAttribute("title"), aria: a.getAttribute("aria-label"), text: (a.innerText || "").trim().slice(0, 30) }));
});
console.log("\nlinks da sidebar:", JSON.stringify(nav, null, 1));
await p.locator("aside a").first().hover().catch(() => {});
await p.waitForTimeout(1200);
await p.screenshot({ path: "qa-screenshots/dbg-sidebar-hover.png", clip: { x: 0, y: 0, width: 300, height: 500 } }).catch(() => {});
await browser.close();
