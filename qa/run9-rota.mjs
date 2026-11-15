// Cria pedido de entrega + leva até "out" p/ o mapa de entregas renderizar + atribuir motoboy.
import { launch, login, BASE, SLUG, VIEWPORTS } from "./lib.mjs";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#")).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const browser = await launch();
const ctxPub = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await ctxPub.newPage();
await p.setViewportSize(VIEWPORTS.desktop);
await p.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
await p.getByRole("button", { name: "Aceitar" }).click().catch(() => {});
await p.locator('button[aria-label="Adicionar pizzas tradicionais"]').click();
await p.waitForTimeout(1000);
await p.locator('.pdetail-option:has-text("Mussarela") input').check();
await p.waitForTimeout(400);
await p.locator(".pdetail-cta").click();
await p.waitForTimeout(900);
await p.locator(".cartbar").click();
await p.waitForTimeout(800);
await p.locator(".btn-finalizar-carrinho").click();
await p.waitForTimeout(2000);
await p.getByRole("radio", { name: /Entrega/ }).click();
await p.waitForTimeout(800);
await p.fill('input[placeholder="Seu nome completo"]', "QA Rota Mapa");
await p.fill('input[placeholder="(11) 99999-9999"]', "92991532663");
await p.fill('input[placeholder="Rua, número..."]', "Rua São Sebastião");
await p.waitForTimeout(2500);
await p.keyboard.press("Escape");
await p.click('input[placeholder="Rua, número..."]', { position: { x: 5, y: 5 } });
await p.keyboard.press("Backspace");
await p.waitForTimeout(2500);
await p.keyboard.press("Escape");
await p.waitForTimeout(800);
await p.fill('input[placeholder="00000-000"]', "69010000");
await p.waitForTimeout(1200);
await p.fill('input[placeholder="Número"]', "250");
await p.waitForTimeout(400);
const sel = p.locator("select").first();
const coroado = await sel.locator("option").nth(1).getAttribute("value");
await sel.selectOption(coroado);
await p.waitForTimeout(600);
await p.locator(".btn-mapa").first().click();
await p.waitForTimeout(9000);
console.log("finalizar disabled:", await p.locator(".btn-finalizar").isDisabled(), "| total:", await p.evaluate(() => document.querySelector(".cta-total strong")?.textContent));
await p.locator(".btn-finalizar").click();
await p.waitForTimeout(9000);
console.log("url:", p.url().replace(BASE, ""));
await p.close(); await ctxPub.close();

const { data } = await sb.from("orders").select("id,code,status,type").eq("customer_name", "QA Rota Mapa").order("created_at", { ascending: false }).limit(1);
const ord = data?.[0];
console.log("pedido:", JSON.stringify(ord));
if (!ord) { await browser.close(); process.exit(1); }

const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const ctx = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/painel`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(4000);
for (const s of ["confirmed", "preparing", "out"]) {
  const r = await p2.evaluate(async ([oid, st]) => {
    const res = await fetch(`/api/orders/${oid}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: st }) });
    return `${res.status} ${(await res.text()).slice(0, 120)}`;
  }, [ord.id, s]);
  console.log(`→ ${s}: ${r}`);
  await p2.waitForTimeout(1200);
}
const tiles = [];
p2.on("response", (r2) => { if (/tile|openstreetmap/i.test(r2.url())) tiles.push(`${r2.status()}`); });
p2.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 220)); });
await p2.goto(`${BASE}/painel/entregas`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p2.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p2.waitForTimeout(400); }
await p2.waitForTimeout(9000);
console.log("\nENTREGAS:", (await p2.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 700));
console.log("mapa:", JSON.stringify(await p2.evaluate(() => ({ leaflet: !!document.querySelector(".leaflet-container"), tiles: document.querySelectorAll(".leaflet-tile").length, markers: document.querySelectorAll(".leaflet-marker-icon").length, paths: document.querySelectorAll(".leaflet-overlay-pane path").length }))));
console.log("tiles baixados:", tiles.length);
await p2.screenshot({ path: "qa-screenshots/adm-entregas-mapa.png", fullPage: true, scale: "css" });

const at = p2.getByRole("button", { name: /Atribuir motoboy/i }).first();
if (await at.count()) {
  await at.click();
  await p2.waitForTimeout(5000);
  console.log("\n[modal atribuir]", (await p2.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 600));
  console.log("[modal leaflet]", JSON.stringify(await p2.evaluate(() => ({ leaflet: !!document.querySelector(".leaflet-container"), markers: document.querySelectorAll(".leaflet-marker-icon").length }))));
  await p2.screenshot({ path: "qa-screenshots/adm-entregas-modal-atribuir.png", fullPage: true, scale: "css" });
}
await browser.close();
