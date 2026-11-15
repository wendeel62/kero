import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const ctx = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await ctx.newPage();
await p.goto(BASE + "/painel", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
// logout no rodapé da sidebar (desktop expande)
const btn = p.getByRole("button", { name: /Sair|Logout/i }).first();
console.log("botão sair encontrado:", await btn.count());
const btns = await p.evaluate(() => [...document.querySelectorAll("button")].map(b => (b.innerText || b.getAttribute("aria-label") || b.title || "?").trim()).filter(Boolean));
console.log("botões no painel:", JSON.stringify(btns));
if (await btn.count()) {
  await btn.click();
  await p.waitForTimeout(5000);
  console.log("após logout -> url:", p.url().replace(BASE, ""));
  await p.goto(BASE + "/painel", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  console.log("acesso após logout -> url:", p.url().replace(BASE, ""));
}
await browser.close();
