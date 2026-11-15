// 4) Admin: pedidos (filtros, mudança de status, detalhe, impressão), multi-loja.
import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const log = [];
const say = (...a) => { const s = a.join(" "); console.log(s); log.push(s); };
const net = [];

async function newPage(vp = "desktop") {
  const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS[vp], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") net.push(`[${vp}] CONSOLE ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => net.push(`[${vp}] PAGEERROR ${String(e).slice(0, 200)}`));
  p.on("response", (r) => { if (r.status() >= 400) net.push(`[${vp}] ${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
  return { c, p };
}
const ready = async (p, ms = 20000) => { for (let i = 0; i < ms / 400; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (!/Carregando/.test(t)) return t; await p.waitForTimeout(400); } return await p.evaluate(() => document.body?.innerText ?? ""); };
const txt = async (p) => (await p.evaluate(() => document.body?.innerText ?? "")).replace(/\n+/g, " | ");

// ---------------- PEDIDOS ----------------
{
  const { c, p } = await newPage();
  await p.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
  await ready(p);
  say(`\n=== PEDIDOS ===\n${(await txt(p)).slice(0, 600)}`);

  // filtro Entrega / Retirada
  for (const f of ["Entrega", "Retirada", "Todos"]) {
    await p.getByRole("button", { name: f, exact: true }).click().catch(() => {});
    await p.waitForTimeout(1200);
    const cards = await p.evaluate(() => [...document.querySelectorAll("article, [data-pedido], .kanban-card")].length);
    const txts = await p.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
    say(`[filtro ${f}] cards=${cards} | ${txts.slice(txts.indexOf("NOVOS"), txts.indexOf("NOVOS") + 200) || txts.slice(0, 200)}`);
  }

  // período
  for (const per of ["7 dias", "30 dias", "90 dias", "Personalizado"]) {
    await p.getByRole("button", { name: per, exact: true }).click().catch((e) => say(`  [período ${per}] erro: ${e.message.slice(0, 60)}`));
    await p.waitForTimeout(2000);
    say(`[período ${per}] url=${p.url().replace(BASE, "")} | ${(await txt(p)).slice(0, 220)}`);
  }
  await p.screenshot({ path: "qa-screenshots/adm-pedidos-personalizado.png", fullPage: true, scale: "css" });

  // volta pra Hoje
  await p.getByRole("button", { name: "Hoje", exact: true }).click();
  await p.waitForTimeout(2000);

  // confirmar pedido
  const antes = await p.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
  const btnConfirmar = p.getByRole("button", { name: /Confirmar/ }).first();
  if (await btnConfirmar.count()) {
    await btnConfirmar.click();
    await p.waitForTimeout(3000);
    const depois = await p.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
    say(`\n[confirmar pedido] mudou? ${antes !== depois}`);
    say(`  antes: ${antes.slice(antes.indexOf("NOVOS"), antes.indexOf("NOVOS") + 260)}`);
    say(`  depois: ${depois.slice(depois.indexOf("NOVOS"), depois.indexOf("NOVOS") + 260)}`);
    await p.screenshot({ path: "qa-screenshots/adm-pedidos-confirmado.png", fullPage: true, scale: "css" });
  } else say("[confirmar pedido] botão não encontrado");

  // abrir detalhe do pedido (clique no card)
  const card = p.locator("article").first();
  if (await card.count()) {
    await card.click();
    await p.waitForTimeout(2500);
    say(`\n[detalhe do pedido] url=${p.url().replace(BASE, "")}`);
    say(`  ${(await txt(p)).slice(0, 700)}`);
    await p.screenshot({ path: "qa-screenshots/adm-pedido-detalhe.png", fullPage: true, scale: "css" });
  }

  // impressão
  const { c: c2, p: p2 } = await newPage();
  await p2.goto(`${BASE}/painel/pedidos`, { waitUntil: "domcontentloaded" });
  await ready(p2);
  const href = await p2.evaluate(() => {
    const a = [...document.querySelectorAll("a[href*='/print']")][0];
    return a?.getAttribute("href") ?? null;
  });
  say(`\n[link impressão] href=${href}`);
  if (href) {
    await p2.goto(BASE + href, { waitUntil: "domcontentloaded" });
    await p2.waitForTimeout(4000);
    say(`[cupom 80mm] ${(await txt(p2)).slice(0, 700)}`);
    await p2.screenshot({ path: "qa-screenshots/adm-cupom-80mm.png", fullPage: true, scale: "css" });
    const dim = await p2.evaluate(() => { const el = document.querySelector(".cupom"); const r = el?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; });
    say(`[cupom 80mm] dimensão render = ${JSON.stringify(dim)} (80mm ≈ 302px CSS @96dpi)`);
  }
  await p2.close(); await c2.close();

  // via do cliente (página do pedido)
  const { c: c3, p: p3 } = await newPage();
  await p3.goto(`${BASE}/pizzariadokbc/pedido/7021c187-8474-4806-8130-c68583cf25b0`, { waitUntil: "domcontentloaded" });
  await p3.waitForTimeout(4000);
  say(`\n[via do cliente] ${(await txt(p3)).slice(0, 500)}`);
  await p3.close(); await c3.close();

  await p.close(); await c.close();
}

// ---------------- MULTI-LOJA ----------------
say(`\n=== ISOLAMENTO ENTRE LOJAS ===`);
const otherOrder = "116062ee-5550-41d2-8f19-5704d34144ca"; // pedido da loja-qa-hermes
{
  const { c, p } = await newPage();
  await p.goto(`${BASE}/painel/pedidos/${otherOrder}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  say(`[pedido de outra loja] url=${p.url().replace(BASE, "")}`);
  say(`  texto = ${(await txt(p)).slice(0, 500)}`);
  await p.screenshot({ path: "qa-screenshots/multi-loja-pedido-alheio.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
}
{
  const { c, p } = await newPage();
  await p.goto(`${BASE}/painel/pedidos/${otherOrder}/print`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  say(`[cupom de outra loja] texto = ${(await txt(p)).slice(0, 400)}`);
  await p.screenshot({ path: "qa-screenshots/multi-loja-cupom-alheio.png", fullPage: true, scale: "css" });
  await p.close(); await c.close();
}
{
  const { c, p } = await newPage();
  await p.goto(`${BASE}/painel/pedidos?store_id=cda9a418-1995-4c6f-86db-cc112fdd3def`, { waitUntil: "domcontentloaded" });
  await ready(p);
  say(`[pedidos?store_id=outra] ${(await txt(p)).slice(0, 400)}`);
  await p.close(); await c.close();
}

fs.writeFileSync("qa/out/admin-pedidos.txt", log.join("\n"));
say(`\n=== rede/console ===\n${net.join("\n") || "(sem erros)"}`);
await browser.close();
