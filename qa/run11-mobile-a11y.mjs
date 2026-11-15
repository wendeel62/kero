// 11) Mobile (sacola/checkout) + teclado/a11y. Dispensa o banner por JS (badge do dev cobre o botão).
import { launch, BASE, SLUG, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };
const net = [];

{
  const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo", isMobile: true, hasTouch: true, viewport: VIEWPORTS.mobile, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") net.push(`MOB CONSOLE ${m.text().slice(0, 200)}`); });
  await p.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  const banner = await p.evaluate(() => {
    const b = document.querySelector('[data-testid="cookie-banner"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const btns = [...b.querySelectorAll("button")].map(x => { const br = x.getBoundingClientRect(); return { t: x.innerText.trim(), x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height), vis: br.width > 0 && br.height > 0 }; });
    return { rect: { y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom) }, viewportH: window.innerHeight, btns, role: b.getAttribute("role"), aria: b.getAttribute("aria-label") };
  });
  say(`[banner cookies mobile] ${JSON.stringify(banner)}`);
  await p.screenshot({ path: "qa-screenshots/mob-cookie-banner.png", fullPage: false, scale: "css" });
  // recusa (deve não bloquear o cardápio)
  await p.evaluate(() => { const b = [...document.querySelectorAll('[data-testid="cookie-banner"] button')].find(x => /recusar/i.test(x.innerText)); b?.click(); });
  await p.waitForTimeout(1000);
  say(`[banner após Recusar] presente=${await p.evaluate(() => !!document.querySelector('[data-testid="cookie-banner"]'))}`);
  // cookie salvo?
  say(`[cookie storage] ${JSON.stringify(await p.evaluate(() => Object.keys(localStorage).map(k => `${k}=${String(localStorage.getItem(k)).slice(0, 30)}`)))}`);

  await p.locator('button[aria-label="Adicionar x-salada"]').click();
  await p.waitForTimeout(1200);
  await p.locator('.pdetail-option:has-text("Mussarela") input').check();
  await p.waitForTimeout(400);
  await p.screenshot({ path: "qa-screenshots/mob-produto-modal.png", fullPage: false, scale: "css" });
  await p.locator(".pdetail-cta").click();
  await p.waitForTimeout(900);
  await p.locator(".cartbar").click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: "qa-screenshots/mob-sacola.png", fullPage: false, scale: "css" });
  say(`[mob sacola] ${(await p.evaluate(() => document.querySelector('[aria-label="Sacola"]')?.innerText ?? "-")).replace(/\n+/g, " | ")}`);
  await p.locator(".btn-finalizar-carrinho").click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: "qa-screenshots/mob-checkout.png", fullPage: false, scale: "css" });
  const ov = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  say(`[mob checkout] scrollW=${ov.w} clientW=${ov.c} overflowX=${ov.w > ov.c + 1}`);
  const tiny = await p.evaluate(() => [...document.querySelectorAll("button,a[href],input,select")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32); }).map(e => ({ t: e.tagName, l: (e.innerText || e.getAttribute("aria-label") || e.placeholder || "?").trim().replace(/\n/g," ").slice(0, 22), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
  say(`[mob alvos <32px] ${JSON.stringify([...new Map(tiny.map(t => [t.l + t.w + t.h, t])).values()].slice(0, 12))}`);
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(400);
  say(`[mob scroll] scrollY=${await p.evaluate(() => Math.round(window.scrollY))}`);
  await p.close(); await ctx.close();
}

// teclado
{
  const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const b = [...document.querySelectorAll('[data-testid="cookie-banner"] button')].find(x => /recusar/i.test(x.innerText)); b?.click(); });
  await p.waitForTimeout(600);
  const seq = [];
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press("Tab");
    seq.push(await p.evaluate(() => { const a = document.activeElement; return `${a.tagName}${(a.getAttribute("aria-label") || a.innerText || a.placeholder || a.getAttribute("href") || "").trim().replace(/\n/g, "/").slice(0, 26)}`; }));
  }
  say(`\n[tab order vitrine] ${JSON.stringify(seq)}`);
  await p.locator('button[aria-label="Adicionar x-salada"]').click();
  await p.waitForTimeout(1200);
  const seq2 = [];
  for (let i = 0; i < 8; i++) { await p.keyboard.press("Tab"); seq2.push(await p.evaluate(() => { const a = document.activeElement; return `${a.tagName}${(a.getAttribute("aria-label") || a.innerText || a.placeholder || "").trim().replace(/\n/g,"/").slice(0, 24)}`; })); }
  say(`[tab order modal produto] ${JSON.stringify(seq2)}`);
  say(`[foco dentro do modal?]`);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(700);
  say(`  modal após ESC: ${await p.evaluate(() => !!document.querySelector(".pdetail-dialog"))} | banner presente: ${await p.evaluate(() => !!document.querySelector('[data-testid="cookie-banner"]'))}`);
  await p.close(); await ctx.close();
}
fs.writeFileSync("qa/out/mobile-a11y.txt", log.join("\n"));
say(`\n=== rede/console ===\n${net.join("\n") || "(sem erros)"}`);
await browser.close();
