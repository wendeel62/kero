import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/Carregando/.test(t)) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2500);

const snap = async (label) => {
  const d = await p.evaluate(() => {
    const cols = [...document.querySelectorAll("section")].map((s) => {
      const h = s.querySelector("h2")?.textContent ?? "?";
      const types = [...s.querySelectorAll("article span.rounded-full")].map((a) => a.textContent).filter(t => /Entrega|Retirada/.test(t));
      return `${h}=${types.length ? types.join("/") : types.length === 0 ? "0" : "-"}`;
    });
    return cols.slice(0, 2).join(" | ") + " || " + cols.slice(-2).join(" | ");
  });
  console.log(`${label.padEnd(22)} ${d}`);
};
await snap("inicial");
await p.getByRole("button", { name: "Entrega", exact: true }).click();
for (const t of [500, 1500, 3000, 6000, 10000, 15000]) { await p.waitForTimeout(t === 500 ? 500 : 500); await snap(`+${t}ms`); }
console.log("\n--- recarrega e clica Entrega de novo (1º clique) ---");
await p.reload({ waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/Carregando/.test(t)) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2500);
await snap("inicial (reload)");
await p.getByRole("button", { name: "Entrega", exact: true }).click();
await p.waitForTimeout(8000);
await snap("8s após Entrega");
await browser.close();
