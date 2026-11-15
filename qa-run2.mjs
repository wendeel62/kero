import { launch, visit, report, attach, BASE } from "./qa-audit.mjs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });

// ---- login
const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
const bag = { console: [], net: [], api: [] };
attach(page, bag, { label: "login" });
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
const inputs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("input,button")).map((e, i) => `${i}:${e.tagName}[type=${e.type}][name=${e.name}][ph=${e.placeholder}] ${(e.innerText || "").trim()} ${e.getAttribute("aria-label") || ""}`)
);
console.log("LOGIN FIELDS:\n" + inputs.join("\n"));
await page.screenshot({ path: "qa-screenshots/admin-login-form.png", scale: "css" });

await page.fill('input[type="email"]', "pizzaria123@gmail.com");
await page.fill('input[type="password"]', "KeroAdmin2026!");
await page.screenshot({ path: "qa-screenshots/admin-login-filled.png", scale: "css" });
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 }).catch((e) => console.log("WAIT_URL_ERR", String(e).slice(0, 200))),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(4000);
console.log("AFTER LOGIN URL:", page.url());
console.log("AFTER LOGIN TEXT:", (await page.evaluate(() => document.body.innerText)).slice(0, 2000));
console.log("LOGIN CONSOLE:", JSON.stringify(bag.console, null, 1));
await page.screenshot({ path: "qa-screenshots/admin-after-login.png", fullPage: true, scale: "css" });
await page.close();

// ---- admin routes desktop
const routes = [
  ["/painel", "adm-hoje"],
  ["/painel/pedidos", "adm-pedidos"],
  ["/painel/pdv", "adm-pdv"],
  ["/painel/entregas", "adm-entregas"],
  ["/painel/cardapio", "adm-cardapio"],
  ["/painel/clientes", "adm-clientes"],
  ["/painel/configuracoes", "adm-config"],
  ["/painel/whatsapp", "adm-whatsapp"],
  ["/painel/financeiro", "adm-financeiro"],
];
const rows = [];
for (const [url, label] of routes) {
  rows.push(await visit(ctx, url, label, { viewport: "desktop", wait: 2500 }));
}
report(rows);
await browser.close();
