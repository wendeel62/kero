import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 300)));
p.on("request", (r) => { if (r.url().includes("/api/orders")) console.log(`REQ ${r.method()} ${r.url().replace(BASE, "")} body=${r.postData()}`); });
p.on("response", async (r) => { if (r.url().includes("/api/orders")) console.log(`RES ${r.status()} ${r.url().replace(BASE, "")} body=${(await r.text().catch(() => "")).slice(0, 300)}`); });

await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 50; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2500);

const cols = async () => p.evaluate(() => [...document.querySelectorAll("section")].slice(0, 2).map((s) => `${s.querySelector("h2")?.textContent}=${[...s.querySelectorAll("article")].length}`).join(" | "));
console.log("antes:", await cols());

const btn = p.locator("article button", { hasText: "Confirmar" }).first();
console.log("botão encontrado:", await btn.count(), "| texto:", await btn.innerText().catch(() => "-"));
console.log("visível/enabled:", await btn.isVisible(), await btn.isEnabled());
await btn.click();
console.log("clicado");
await p.waitForTimeout(600);
console.log("600ms depois:", await cols());
await p.waitForTimeout(2500);
console.log("3s depois:", await cols());
await p.waitForTimeout(5000);
console.log("8s depois:", await cols());
const alerta = await p.evaluate(() => document.querySelector('[role="alert"]')?.textContent ?? null);
console.log("alerta:", alerta);
await p.screenshot({ path: "qa-screenshots/dbg-status-change.png", fullPage: true, scale: "css" });
await browser.close();
