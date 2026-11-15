import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
p.on("response", async (r) => { if (r.url().includes("/api/orders") && r.request().method() === "PATCH") console.log(`  PATCH ${r.status()} ${(await r.text().catch(()=>"")).slice(0,120)}`); });
await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2500);

const snap = async (l) => {
  const d = await p.evaluate(() => [...document.querySelectorAll("section")].map((s) => `${s.querySelector("h2")?.textContent}:[${[...s.querySelectorAll("article")].map(a => a.querySelector("span.font-extrabold")?.textContent + "/" + [...a.querySelectorAll("article span")].length).join(",")}]`).join("  "));
  const b = await p.evaluate(() => [...document.querySelectorAll("article button")].map(x => x.innerText.trim().replace(/\n/g, " ")).join(" / "));
  console.log(`${l.padEnd(16)} ${d}\n${"".padEnd(16)} botões: ${b}`);
};
await snap("inicial");
const b = p.locator("article button", { hasText: "P/ preparo" }).first();
console.log("clicando em:", await b.innerText());
await b.click();
await snap("0ms");
await p.waitForTimeout(1200); await snap("1.2s");
await p.waitForTimeout(3000); await snap("4.2s");
await p.waitForTimeout(6000); await snap("10s");
await p.waitForTimeout(10000); await snap("20s");
await browser.close();
