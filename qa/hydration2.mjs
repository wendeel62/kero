import { launch, BASE, VIEWPORTS } from "./lib.mjs";
const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
// login com credencial errada (a que o briefing deu) -> renderiza estado de erro
const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${m.type()}] ${m.text().slice(0, 500)}`); });
p.on("pageerror", (e) => errs.push(`[pageerror] ${String(e).slice(0, 300)}`));
await p.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
await p.fill('input[type="email"]', "pizzaria123@gmail.com");
await p.fill('input[type="password"]', "KeroAdmin2026!");
await p.click('button[type="submit"]');
await p.waitForTimeout(6000);
console.log("url:", p.url().replace(BASE, ""));
console.log("texto:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 300));
console.log("erros:", errs.length ? errs.join("\n---\n") : "(nenhum)");
await p.screenshot({ path: "qa-screenshots/login-senha-errada.png", scale: "css" });
// é a senha do briefing que está errada?
await p.fill('input[type="password"]', "LojistaTest2026!");
await p.click('button[type="submit"]');
await p.waitForTimeout(7000);
console.log("\ncom a senha correta -> url:", p.url().replace(BASE, ""));
console.log("erros:", errs.length ? errs.join("\n---\n") : "(nenhum)");
await browser.close();
