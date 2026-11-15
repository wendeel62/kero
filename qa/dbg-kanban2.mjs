import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
p.on("response", async (r) => { if (r.url().includes("/api/orders") && r.request().method() === "PATCH") console.log(`  >> PATCH ${r.status()} ${(await r.text().catch(()=>"")).slice(0,140)}`); });
p.on("console", (m) => { if (m.type() === "error") console.log("  CONSOLE", m.text().slice(0,200)); });
await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2500);

const snap = async (l) => {
  const d = await p.evaluate(() => [...document.querySelectorAll("section")].filter(s=>s.querySelector("h2")).map((s) => `${s.querySelector("h2").textContent}:${[...s.querySelectorAll("article")].map(a=>a.querySelector("span.font-extrabold")?.textContent).join(",")||"-"}`).join(" "));
  console.log(`${l.padEnd(12)} ${d}`);
};
await snap("inicial");
const b = p.locator("article button", { hasText: "Entregar" }).first();
console.log("botão:", await b.count(), await b.innerText().catch(()=>"-"));
if (await b.count()) {
  await b.click();
  for (const t of [100, 300, 600, 1200, 2500, 4000, 8000]) { await p.waitForTimeout(t === 100 ? 100 : 200); await snap(`+${t}`); }
}
await browser.close();
