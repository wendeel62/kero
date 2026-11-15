import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const ctx = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await ctx.newPage();
await p.goto(`${BASE}/painel`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
const id = "97650178-a795-492a-b659-fe9bec8b091d";
const r = await p.evaluate(async ([oid]) => {
  const res = await fetch(`/api/orders/${oid}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "out" }) });
  return `${res.status} ${(await res.text()).slice(0, 200)}`;
}, [id]);
console.log("PATCH para out:", r);

const tiles = [];
p.on("response", (r2) => { if (/tile|openstreetmap/i.test(r2.url())) tiles.push(`${r2.status()} ${r2.url().slice(0, 80)}`); });
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 250)); });
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 250)));
await p.goto(`${BASE}/painel/entregas`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(9000);
console.log("\nENTREGAS:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 800));
console.log("mapa:", JSON.stringify(await p.evaluate(() => ({ leaflet: !!document.querySelector(".leaflet-container"), tiles: document.querySelectorAll(".leaflet-tile").length, markers: document.querySelectorAll(".leaflet-marker-icon").length, paths: document.querySelectorAll(".leaflet-overlay-pane path").length, markers: [...document.querySelectorAll(".leaflet-marker-icon")].map(m => m.innerText.trim().slice(0, 24)) }))));
console.log("tiles:", tiles.slice(0, 3).join(" || ") || "(nenhum)");
await p.screenshot({ path: "qa-screenshots/adm-entregas-mapa.png", fullPage: true, scale: "css" });

// modal atribuir motoboy
const at = p.getByRole("button", { name: /Atribuir motoboy/i }).first();
if (await at.count()) {
  await at.click();
  await p.waitForTimeout(4000);
  console.log("\n[modal atribuir] ", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 700));
  console.log("[modal leaflet]", JSON.stringify(await p.evaluate(() => ({ leaflet: !!document.querySelector(".leaflet-container"), markers: document.querySelectorAll(".leaflet-marker-icon").length }))));
  await p.screenshot({ path: "qa-screenshots/adm-entregas-modal-atribuir.png", fullPage: true, scale: "css" });
}
await browser.close();
