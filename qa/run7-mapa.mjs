// 7) Mapa de entregas: avança um pedido até "pronto" p/ o mapa renderizar + checa realtime.
import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };

// avança o pedido 848d35e6 (QA Playwright 2) até "ready"
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
p.on("response", async (r) => { if (r.url().includes("/api/orders") && r.request().method() === "PATCH") console.log(`PATCH ${r.status()} body=${(await r.text().catch(()=>"")).slice(0,160)}`); });
await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2000);
for (const alvo of ["P/ preparo", "Pronto"]) {
  const b = p.locator("article button", { hasText: alvo }).first();
  if (!(await b.count())) { say(`[${alvo}] botão não encontrado`); break; }
  await b.click();
  await p.waitForTimeout(3500);
  const cols = await p.evaluate(() => [...document.querySelectorAll("section")].slice(0, 4).map((s) => `${s.querySelector("h2")?.textContent}=${s.querySelectorAll("article").length}`).join(" | "));
  say(`[após ${alvo}] ${cols}`);
}
await p.close(); await c.close();

// abre entregas
const c2 = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p2 = await c2.newPage();
const tiles = [];
p2.on("response", (r) => { if (/tile|openstreetmap/i.test(r.url())) tiles.push(`${r.status()} ${r.url().slice(0, 100)}`); });
p2.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") say(`CONSOLE[${m.type()}] ${m.text().slice(0, 250)}`); });
p2.on("pageerror", (e) => say(`PAGEERROR ${String(e).slice(0, 250)}`));
await p2.goto(`${BASE}/painel/entregas`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p2.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p2.waitForTimeout(400); }
await p2.waitForTimeout(6000);
say(`\n[ENTREGAS com pedido em rota]\n${(await p2.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 900)}`);
const map = await p2.evaluate(() => ({
  leaflet: !!document.querySelector(".leaflet-container"),
  tiles: document.querySelectorAll(".leaflet-tile").length,
  pins: document.querySelectorAll(".leaflet-marker-icon").length,
  polyline: document.querySelectorAll(".leaflet-overlay-pane path").length,
  rect: document.querySelector(".leaflet-container")?.getBoundingClientRect().toJSON() ?? null,
}));
say(`[mapa] ${JSON.stringify(map)}`);
say(`[tiles] ${tiles.slice(0, 6).join(" || ") || "(nenhum)"}`);
await p2.screenshot({ path: "qa-screenshots/adm-entregas-mapa-com-rota.png", fullPage: true, scale: "css" });

// teste realtime: websocket do supabase
const wsTest = await p2.evaluate(async () => {
  const r = await fetch("/api/orders/848d35e6-9eb3-41c2-bb62-d4b0674a77c8/status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "out" }) });
  return `${r.status} ${(await r.text()).slice(0, 200)}`;
});
say(`[PATCH para out] ${wsTest}`);
await p2.waitForTimeout(4000);
say(`[após out] ${(await p2.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 500)}`);
await p2.screenshot({ path: "qa-screenshots/adm-entregas-mapa-em-rota.png", fullPage: true, scale: "css" });
fs.writeFileSync("qa/out/mapa.txt", log.join("\n"));
await browser.close();
