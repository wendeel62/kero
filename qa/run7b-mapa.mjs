import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2000);
for (const alvo of ["Pronto", "Entregar"]) {
  const b = p.locator("article button", { hasText: alvo }).first();
  if (!(await b.count())) { console.log(`[${alvo}] não encontrado`); break; }
  console.log("clicando:", await b.innerText());
  await b.click();
  await p.waitForTimeout(3500);
}
console.log("colunas:", await p.evaluate(() => [...document.querySelectorAll("section")].map((s) => `${s.querySelector("h2")?.textContent}:${s.querySelectorAll("article").length}`).join(" ")));
await p.close(); await c.close();

// entregas
const c2 = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p2 = await c2.newPage();
const tiles = [];
p2.on("response", (r) => { if (/tile|openstreetmap/i.test(r.url())) tiles.push(`${r.status()} ${r.url().slice(0, 90)}`); });
p2.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 250)); });
p2.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 250)));
await p2.goto(`${BASE}/painel/entregas`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p2.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p2.waitForTimeout(7000);
console.log("\nENTREGAS:", (await p2.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 800));
console.log("mapa:", JSON.stringify(await p2.evaluate(() => ({ leaflet: !!document.querySelector(".leaflet-container"), tiles: document.querySelectorAll(".leaflet-tile").length, markers: document.querySelectorAll(".leaflet-marker-icon").length, paths: document.querySelectorAll(".leaflet-overlay-pane path").length }))));
console.log("tiles:", tiles.slice(0, 5).join(" || ") || "(nenhum)");
await p2.screenshot({ path: "qa-screenshots/adm-entregas-mapa.png", fullPage: true, scale: "css" });
await browser.close();
