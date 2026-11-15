import { launch, BASE, SLUG, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const page = await ctx.newPage();
await page.setViewportSize(VIEWPORTS.desktop);
page.on("console", (m) => console.log(`CONSOLE[${m.type()}] ${m.text().slice(0, 400)}`));
page.on("pageerror", (e) => console.log(`PAGEERROR ${String(e).slice(0, 600)}`));
page.on("requestfailed", (r) => console.log(`REQFAIL ${r.url().slice(0, 150)} ${r.failure()?.errorText}`));
page.on("response", (r) => console.log(`RESP ${r.status()} ${r.request().method()} ${r.url().slice(0, 150)}`));

const token = "e98ab2b6-412b-4d05-bb7d-0730e33b4423";
console.log("--- goto direto ---");
await page.goto(`${BASE}/${SLUG}/pedido/${token}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
console.log("BODY:", (await page.evaluate(() => document.body.innerText)).slice(0, 500));
console.log("HTML len:", (await page.content()).length);
console.log("has next data:", await page.evaluate(() => !!document.querySelector("script#__NEXT_DATA__") || !!document.querySelector("script[src*='main-app']")));
await page.screenshot({ path: "qa-screenshots/dbg-tracking.png", fullPage: true, scale: "css" });

console.log("\n--- fetch manual na pagina ---");
console.log(await page.evaluate(async () => {
  try {
    const r = await fetch("/api/orders/track/" + location.pathname.split("/").pop());
    return `${r.status} ${(await r.text()).slice(0, 200)}`;
  } catch (e) { return "EXC " + String(e); }
}));

console.log("\n--- query params / pathname ---");
console.log(await page.evaluate(() => ({ path: location.pathname, search: location.search })));
await browser.close();
