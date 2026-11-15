import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
const tiles = [];
p.on("response", (r) => { if (/tile|openstreetmap|leaflet/i.test(r.url())) tiles.push(`${r.status()} ${r.url().slice(0, 110)}`); });
p.on("requestfailed", (r) => { if (/tile|openstreetmap|leaflet/i.test(r.url())) tiles.push(`FAILED ${r.failure()?.errorText} ${r.url().slice(0, 110)}`); });
p.on("console", (m) => console.log(`CONSOLE[${m.type()}] ${m.text().slice(0, 300)}`));
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 300)));

await p.goto(`${BASE}/painel/entregas`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(6000);

const diag = await p.evaluate(() => {
  const imgs = [...document.images].map(i => ({ src: (i.currentSrc || i.src).slice(-100), nw: i.naturalWidth, nh: i.naturalHeight, w: i.getBoundingClientRect().width, alt: i.alt }));
  const leaflet = document.querySelector(".leaflet-container");
  const panes = [...document.querySelectorAll(".leaflet-pane")].map(p => ({ cls: p.className, children: p.children.length }));
  return { imgs, hasLeaflet: !!leaflet, leafletRect: leaflet ? leaflet.getBoundingClientRect().toJSON() : null, panes, tileCount: document.querySelectorAll(".leaflet-tile").length };
});
console.log(JSON.stringify(diag, null, 1).slice(0, 3000));
console.log("\nTILES:", tiles.slice(0, 12).join("\n"));
await p.screenshot({ path: "qa-screenshots/dbg-entregas-mapa.png", fullPage: false, scale: "css" });
await browser.close();
