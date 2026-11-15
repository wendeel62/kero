// 4b) Admin: status de pedido, detalhe, impressão, cardápio CRUD, config, whatsapp, entregas.
import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };
const net = [];

async function open(url, vp = "desktop") {
  const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS[vp], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") net.push(`CONSOLE ${m.text().slice(0, 220)}`); });
  p.on("pageerror", (e) => net.push(`PAGEERROR ${String(e).slice(0, 220)}`));
  p.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
  await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 50; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/^Carregando/.test(t.trim()) && t.length > 150) break; await p.waitForTimeout(400); }
  await p.waitForTimeout(2000);
  return { c, p };
}
const txt = async (p) => (await p.evaluate(() => document.body?.innerText ?? "")).replace(/\n+/g, " | ");

// ============ 1. mudança de status + detalhe ============
{
  const { c, p } = await open("/painel/pedidos");
  const cards = await p.evaluate(() => [...document.querySelectorAll("article")].map(a => a.innerText.replace(/\n+/g, " | ")));
  say(`\n=== PEDIDOS (cards) ===\n${cards.slice(0, 4).join("\n")}`);

  const btn = p.locator("button", { hasText: /^Confirmar/ }).first();
  if (await btn.count()) {
    await btn.click();
    await p.waitForTimeout(5000);
    say(`\n[após Confirmar] ${(await txt(p)).slice(0, 700)}`);
    await p.screenshot({ path: "qa-screenshots/adm-pedidos-apos-confirmar.png", fullPage: true, scale: "css" });
  }

  // detalhe
  await p.locator("article").first().click();
  await p.waitForTimeout(4000);
  say(`\n[detalhe] url=${p.url().replace(BASE, "")}`);
  say(`[detalhe] ${(await txt(p)).slice(0, 900)}`);
  await p.screenshot({ path: "qa-screenshots/adm-pedido-detalhe.png", fullPage: true, scale: "css" });
  const btnsDetalhe = await p.evaluate(() => [...document.querySelectorAll("button,a[href]")].map(b => (b.innerText || b.getAttribute("aria-label") || b.getAttribute("href") || "?").trim().replace(/\n/g, "/").slice(0, 30)));
  say(`[detalhe] botões/links: ${JSON.stringify([...new Set(btnsDetalhe)])}`);
  const dim = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  say(`[detalhe] scrollW=${dim.w} clientW=${dim.c}`);
  await p.close(); await c.close();
}

// ============ 2. impressão 80mm ============
{
  const { c, p } = await open("/painel/pedidos");
  const href = await p.evaluate(() => [...document.querySelectorAll("a[href*='/print']")].map(a => a.getAttribute("href")));
  say(`\n[links de impressão] ${JSON.stringify(href)}`);
  if (href.length) {
    const { c: c2, p: p2 } = await open(href[0]);
    say(`[cupom] ${(await txt(p2)).slice(0, 900)}`);
    const dim = await p2.evaluate(() => { const el = document.querySelector(".cupom"); const r = el?.getBoundingClientRect(); const st = el ? getComputedStyle(el) : null; return r ? { w: Math.round(r.width), h: Math.round(r.height), widthCss: st?.width, print: st?.printColorAdjust } : null; });
    say(`[cupom 80mm] ${JSON.stringify(dim)} — 80mm = 302px CSS`);
    await p2.screenshot({ path: "qa-screenshots/adm-cupom-80mm.png", fullPage: true, scale: "css" });
    await p2.emulateMedia({ media: "print" });
    await p2.waitForTimeout(800);
    await p2.screenshot({ path: "qa-screenshots/adm-cupom-80mm-print.png", fullPage: true, scale: "css" });
    say(`[cupom print] screenshot salvo`);
    await p2.close(); await c2.close();
  }
  await p.close(); await c.close();
}

// ============ 3. cardápio CRUD ============
{
  const { c, p } = await open("/painel/cardapio");
  say(`\n=== CARDÁPIO ===\n${(await txt(p)).slice(0, 800)}`);
  const abas = await p.evaluate(() => [...document.querySelectorAll("button")].map(b => (b.innerText || "").trim().replace(/\n/g, "/")).filter(Boolean).slice(0, 40));
  say(`[abas/botões] ${JSON.stringify(abas)}`);

  // aba produtos
  await p.getByRole("button", { name: /Produtos/ }).first().click().catch((e) => say("  aba produtos:", e.message.slice(0, 60)));
  await p.waitForTimeout(2500);
  say(`[aba produtos] ${(await txt(p)).slice(0, 700)}`);
  await p.screenshot({ path: "qa-screenshots/adm-cardapio-produtos.png", fullPage: true, scale: "css" });

  // criar categoria
  await p.getByRole("button", { name: /Categorias/ }).first().click();
  await p.waitForTimeout(1500);
  const criar = p.getByRole("button", { name: /Criar|Nova|Adicionar/i }).first();
  say(`[botão criar] ${await criar.count()}`);
  if (await criar.count()) {
    await criar.click();
    await p.waitForTimeout(1500);
    say(`[modal criar] ${(await txt(p)).slice(0, 500)}`);
    const inputs = await p.evaluate(() => [...document.querySelectorAll("input,textarea,select")].map(i => ({ tag: i.tagName, type: i.type, ph: i.placeholder, label: i.labels?.[0]?.innerText?.trim() ?? null, id: i.id, name: i.name })));
    say(`[modal inputs] ${JSON.stringify(inputs)}`);
    await p.screenshot({ path: "qa-screenshots/adm-cardapio-modal-criar.png", fullPage: true, scale: "css" });
  }
  await p.close(); await c.close();
}

// ============ 4. config ============
{
  const { c, p } = await open("/painel/configuracoes");
  say(`\n=== CONFIG ===\n${(await txt(p)).slice(0, 1200)}`);
  const abas = await p.evaluate(() => [...document.querySelectorAll("button")].map(b => (b.innerText || "").trim().replace(/\n/g, "/")).filter(Boolean));
  say(`[abas] ${JSON.stringify([...new Set(abas)].slice(0, 40))}`);
  await p.screenshot({ path: "qa-screenshots/adm-config-full.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
}

// ============ 5. whatsapp ============
{
  const { c, p } = await open("/painel/whatsapp");
  say(`\n=== WHATSAPP ===\n${(await txt(p)).slice(0, 900)}`);
  await p.screenshot({ path: "qa-screenshots/adm-whatsapp-full.png", fullPage: true, scale: "css" });
  const chats = await p.evaluate(() => [...document.querySelectorAll("li, [role=listitem], button")].map(e => (e.innerText || "").trim().replace(/\n+/g, " | ").slice(0, 80)).filter(t => t.length > 3).slice(0, 15));
  say(`[chats] ${JSON.stringify(chats)}`);
  await p.close(); await c.close();
}

// ============ 6. entregas ============
{
  const { c, p } = await open("/painel/entregas");
  say(`\n=== ENTREGAS ===\n${(await txt(p)).slice(0, 900)}`);
  await p.screenshot({ path: "qa-screenshots/adm-entregas-full.png", fullPage: true, scale: "css" });
  const btns = await p.evaluate(() => [...document.querySelectorAll("button")].map(b => (b.innerText || b.getAttribute("aria-label") || "?").trim().replace(/\n/g, "/")).filter(Boolean));
  say(`[botões] ${JSON.stringify([...new Set(btns)].slice(0, 30))}`);
  await p.close(); await c.close();
}

fs.writeFileSync("qa/out/admin-interactions.txt", log.join("\n"));
say(`\n=== rede/console ===\n${net.join("\n") || "(sem erros)"}`);
await browser.close();
