import { launch, BASE, SLUG, VIEWPORTS } from "./lib.mjs";
const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
for (const u of ["/login", "/login/esqueci-senha", `/pizzariadokbc`, "/privacidade", "/motoboy/login"]) {
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${m.type()}] ${m.text().slice(0, 400)}`); });
  p.on("pageerror", (e) => errs.push(`[pageerror] ${String(e).slice(0, 300)}`));
  await p.goto(BASE + u, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  console.log(`\n=== ${u} ===`);
  console.log(errs.length ? errs.join("\n") : "(sem erro de console)");
  await p.close();
}
await browser.close();
