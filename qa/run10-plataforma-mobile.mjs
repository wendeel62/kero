// 10) Área admin (operador da plataforma) + checkout no mobile + acessibilidade por teclado.
import { launch, login, BASE, SLUG, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };
const net = [];
const txt = async (p) => (await p.evaluate(() => document.body?.innerText ?? "")).replace(/\n+/g, " | ");

// ---------- 1. ADMIN da plataforma ----------
{
  const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") net.push(`ADMIN CONSOLE ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => net.push(`ADMIN PAGEERROR ${String(e).slice(0, 200)}`));
  p.on("response", (r) => { if (r.status() >= 400) net.push(`ADMIN ${r.status()} ${r.request().method()} ${r.url().slice(0, 120)}`); });
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  await p.fill('input[type="email"]', "admin@kero.app");
  await p.fill('input[type="password"]', "KeroAdmin2026!");
  await p.click('button[type="submit"]');
  await p.waitForTimeout(7000);
  say(`\n=== ADMIN PLATAFORMA ===\nlogin → ${p.url().replace(BASE, "")}`);
  say((await txt(p)).slice(0, 1200));
  await p.screenshot({ path: "qa-screenshots/plat-admin.png", fullPage: true, scale: "css" });
  for (const u of ["/admin/lojas", "/admin/configuracoes"]) {
    await p.goto(BASE + u, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(5000);
    say(`[${u}] ${(await txt(p)).slice(0, 900)}`);
    await p.screenshot({ path: `qa-screenshots/plat-admin${u.replace(/\//g, "-")}.png`, fullPage: true, scale: "css" });
  }
  // loja específica
  await p.goto(`${BASE}/admin/lojas/5751a74b-5feb-41be-be14-6c3967ca1383`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(5000);
  say(`[loja] ${(await txt(p)).slice(0, 900)}`);
  await p.screenshot({ path: "qa-screenshots/plat-admin-loja.png", fullPage: true, scale: "css" });
  await p.close(); await ctx.close();
}

// ---------- 2. Checkout no mobile ----------
{
  const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo", isMobile: true, hasTouch: true, viewport: VIEWPORTS.mobile, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") net.push(`MOB CONSOLE ${m.text().slice(0, 200)}`); });
  await p.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.getByRole("button", { name: "Aceitar" }).click().catch(() => {});
  await p.locator('button[aria-label="Adicionar x-salada"]').click();
  await p.waitForTimeout(1000);
  await p.locator('.pdetail-option:has-text("Mussarela") input').check();
  await p.waitForTimeout(400);
  await p.locator(".pdetail-cta").click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: "qa-screenshots/mob-produto-modal.png", fullPage: false, scale: "css" });
  await p.locator(".cartbar").click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: "qa-screenshots/mob-sacola.png", fullPage: false, scale: "css" });
  const cartOv = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  say(`\n[mobile sacola] overflow=${JSON.stringify(cartOv)}`);
  await p.locator(".btn-finalizar-carrinho").click();
  await p.waitForTimeout(2000);
  await p.screenshot({ path: "qa-screenshots/mob-checkout.png", fullPage: false, scale: "css" });
  const co = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  say(`[mobile checkout] overflow=${JSON.stringify(co)}`);
  // alvos de toque pequenos
  const tiny = await p.evaluate(() => [...document.querySelectorAll("button,a[href],input,select")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32); }).map(e => ({ t: e.tagName, l: (e.innerText || e.getAttribute("aria-label") || e.placeholder || "?").trim().slice(0, 24), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
  say(`[mobile checkout alvos < 32px] ${JSON.stringify(tiny.slice(0, 12))}`);
  // scroll travado?
  await p.evaluate(() => window.scrollTo(0, 500));
  await p.waitForTimeout(500);
  say(`[scroll] scrollY=${await p.evaluate(() => Math.round(window.scrollY))} bodyOverflow=${await p.evaluate(() => getComputedStyle(document.body).overflow)}`);
  await p.close(); await ctx.close();
}

// ---------- 3. teclado / foco ----------
{
  const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.getByRole("button", { name: "Aceitar" }).click().catch(() => {});
  const seq = [];
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press("Tab");
    seq.push(await p.evaluate(() => { const a = document.activeElement; return `${a.tagName}${a.getAttribute("aria-label") ? `[${a.getAttribute("aria-label")}]` : ""}:${(a.innerText || a.placeholder || a.getAttribute("href") || "").trim().replace(/\n/g, "/").slice(0, 28)}`; }));
  }
  say(`\n[tab order vitrine] ${JSON.stringify(seq)}`);
  // abrir produto e navegar por teclado
  await p.locator('button[aria-label="Adicionar x-salada"]').click();
  await p.waitForTimeout(1000);
  const seq2 = [];
  for (let i = 0; i < 8; i++) { await p.keyboard.press("Tab"); seq2.push(await p.evaluate(() => { const a = document.activeElement; return `${a.tagName}:${(a.innerText || a.getAttribute("aria-label") || a.placeholder || "").trim().replace(/\n/g,"/").slice(0,26)}`; })); }
  say(`[tab order modal] ${JSON.stringify(seq2)}`);
  say(`[foco preso no modal?] escape fecha? `);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(800);
  say(`  modal após ESC: ${await p.evaluate(() => !!document.querySelector(".pdetail-dialog"))}`);
  await p.close(); await ctx.close();
}

fs.writeFileSync("qa/out/admin-plataforma-mobile.txt", log.join("\n"));
say(`\n=== rede/console ===\n${net.join("\n") || "(sem erros)"}`);
await browser.close();
