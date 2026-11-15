import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const ctx = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await ctx.newPage();

async function settle() { for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); } await p.waitForTimeout(2000); }

await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
await settle();
for (const alvo of ["Confirmar", "P/ preparo", "Pronto"]) {
  const b = p.locator("article button", { hasText: alvo }).first();
  if (!(await b.count())) { console.log(`[${alvo}] não encontrado`); continue; }
  await b.click();
  await p.waitForTimeout(3000);
  console.log(`após ${alvo}:`, await p.evaluate(() => [...document.querySelectorAll("section")].filter(s=>s.querySelector("h2")).map((s) => `${s.querySelector("h2").textContent}:${s.querySelectorAll("article").length}`).join(" ")));
}

const tiles = [];
p.on("response", (r) => { if (/tile|openstreetmap/i.test(r.url())) tiles.push(`${r.status()} ${r.url().slice(0, 90)}`); });
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 220)); });
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 220)));
await p.goto(`${BASE}/painel/entregas`, { waitUntil: "domcontentloaded" });
await settle();
await p.waitForTimeout(8000);
console.log("\nENTREGAS:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 900));
console.log("mapa:", JSON.stringify(await p.evaluate(() => ({ leaflet: !!document.querySelector(".leaflet-container"), tiles: document.querySelectorAll(".leaflet-tile").length, markers: document.querySelectorAll(".leaflet-marker-icon").length, paths: document.querySelectorAll(".leaflet-overlay-pane path").length }))));
console.log("tiles:", tiles.slice(0, 4).join(" || ") || "(nenhum)");
await p.screenshot({ path: "qa-screenshots/adm-entregas-mapa.png", fullPage: true, scale: "css" });
await browser.close();
