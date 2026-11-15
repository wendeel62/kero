import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
const t0 = Date.now();
p.on("response", async (r) => {
  if (r.request().method() === "POST" && r.url().includes("/painel/pedidos")) {
    const pd = r.request().postData() ?? "";
    const args = pd.match(/\[[\s\S]*?\]/)?.[0]?.slice(0, 200) ?? pd.slice(0, 120);
    console.log(`SA @${Date.now() - t0}ms status=${r.status()} args=${args}`);
  }
});
await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/Carregando/.test(t)) break; await p.waitForTimeout(400); }
await p.waitForTimeout(3000);
console.log("--- clique Entrega ---");
await p.getByRole("button", { name: "Entrega", exact: true }).click();
await p.waitForTimeout(12000);
const snap = await p.evaluate(() => {
  const cols = [...document.querySelectorAll("section")].slice(0, 2).map((s) => {
    const h = s.querySelector("h2")?.textContent;
    const types = [...s.querySelectorAll("article span.rounded-full")].map((a) => a.textContent).filter(t => /Entrega|Retirada/.test(t));
    return `${h}=${types.join("/") || 0}`;
  });
  return cols.join(" | ");
});
console.log("RESULTADO:", snap);
await browser.close();
