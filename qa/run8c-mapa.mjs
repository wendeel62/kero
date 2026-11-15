import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const ctx = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await ctx.newPage();
await p.goto(`${BASE}/painel`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);

// avança o pedido de entrega até "ready" via API (mesmo caminho do painel)
const id = process.argv[2];
for (const s of ["confirmed", "preparing", "ready"]) {
  const r = await p.evaluate(async ([oid, st]) => {
    const res = await fetch(`/api/orders/${oid}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: st }) });
    return `${res.status} ${(await res.text()).slice(0, 140)}`;
  }, [id, s]);
  console.log(`status → ${s}: ${r}`);
  await p.waitForTimeout(1500);
}

const tiles = [];
p.on("response", (r) => { if (/tile|openstreetmap/i.test(r.url())) tiles.push(`${r.status()} ${r.url().slice(0, 80)}`); });
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 250)); });
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 250)));
await p.goto(`${BASE}/painel/entregas`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(9000);
console.log("\nENTREGAS:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1000));
console.log("mapa:", JSON.stringify(await p.evaluate(() => ({ leaflet: !!document.querySelector(".leaflet-container"), tiles: document.querySelectorAll(".leaflet-tile").length, markers: document.querySelectorAll(".leaflet-marker-icon").length, paths: document.querySelectorAll(".leaflet-overlay-pane path").length, markerHtml: [...document.querySelectorAll(".leaflet-marker-icon")].map(m => m.innerText.trim().slice(0, 20)) }))));
console.log("tiles:", tiles.slice(0, 3).join(" || ") || "(nenhum)");
await p.screenshot({ path: "qa-screenshots/adm-entregas-mapa.png", fullPage: true, scale: "css" });
await browser.close();
