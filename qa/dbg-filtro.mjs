import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
const acts = [];
p.on("response", async (r) => {
  if (r.request().method() === "POST" && r.url().includes("/painel/pedidos")) {
    acts.push(`${r.status()} @${Date.now()}`);
  }
});
await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/Carregando/.test(t)) break; await p.waitForTimeout(400); }
await p.waitForTimeout(2000);

const snap = async (label) => {
  const d = await p.evaluate(() => {
    const cols = [...document.querySelectorAll("section")].map((s) => {
      const h = s.querySelector("h2")?.textContent ?? "?";
      const n = s.querySelector("header span.ml-auto")?.textContent ?? "?";
      const codes = [...s.querySelectorAll("article span.font-extrabold")].map((a) => a.textContent);
      const types = [...s.querySelectorAll("article span.rounded-full")].map((a) => a.textContent).filter(t => /Entrega|Retirada/.test(t));
      return `${h}=${n}${types.length ? ` [${types.join("/")}]` : ""}`;
    });
    const btn = [...document.querySelectorAll("button")].filter(b => /^(Todos|Entrega|Retirada)$/.test(b.textContent.trim())).map(b => `${b.textContent.trim()}${b.className.includes("bg-[var(--text)]") ? "*" : ""}`);
    return { cols, btn };
  });
  console.log(`${label.padEnd(14)} ${d.cols.join(" | ")}   [ativos: ${d.btn.join(",")}]`);
};

await snap("inicial");
for (const f of ["Entrega", "Retirada", "Todos", "Entrega", "Todos"]) {
  await p.getByRole("button", { name: f, exact: true }).click();
  await p.waitForTimeout(3500);
  await snap(`após ${f}`);
}
console.log("\nserver actions:", acts.join(" "));
await browser.close();
