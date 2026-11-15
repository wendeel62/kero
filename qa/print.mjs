import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
p.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0,200)));
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0,300)));
const t = Date.now();
try {
  await p.goto(`${BASE}/painel/pedidos/a673aec4-8681-4f6c-aef8-965a8bbc7c13/print`, { waitUntil: "commit", timeout: 120000 });
  console.log("commit em", Date.now()-t, "ms");
  await p.waitForTimeout(8000);
  console.log("texto:", (await p.evaluate(() => document.body?.innerText ?? "")).replace(/\n+/g," | ").slice(0, 900));
  const dim = await p.evaluate(() => { const el = document.querySelector(".cupom"); const r = el?.getBoundingClientRect(); return r ? {w:Math.round(r.width),h:Math.round(r.height)} : null; });
  console.log("dimensão cupom:", JSON.stringify(dim), "(80mm ≈ 302px)");
  await p.screenshot({ path: "qa-screenshots/adm-cupom-80mm.png", fullPage: true, scale: "css" });
  await p.emulateMedia({ media: "print" });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: "qa-screenshots/adm-cupom-80mm-print.png", fullPage: true, scale: "css" });
} catch (e) { console.log("ERRO:", e.message.slice(0,200)); }
await browser.close();
