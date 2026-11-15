// 3c) Timing real das páginas do painel (warmup autenticado) + APIs chamadas.
import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const { state } = await login(ctx);

const routes = [
  ["/painel", "Hoje"],
  ["/painel/pedidos", "Pedidos"],
  ["/painel/pdv", "PDV"],
  ["/painel/entregas", "Entregas"],
  ["/painel/cardapio", "Cardápio"],
  ["/painel/clientes", "Clientes"],
  ["/painel/configuracoes", "Config"],
  ["/painel/whatsapp", "WhatsApp"],
  ["/painel/financeiro", "Financeiro"],
];

console.log("=== warmup autenticado ===");
for (const [url, label] of routes) {
  const p = await ctx.newPage();
  const t = Date.now();
  await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3000);
  console.log(`${label.padEnd(10)} ${Date.now() - t}ms`);
  await p.close();
}

console.log("\n=== medição (2ª visita, desktop) ===");
for (const [url, label] of routes) {
  const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await c.newPage();
  const apis = [];
  p.on("response", (r) => { if (r.url().includes("/api/") || r.request().method() === "POST") apis.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 90)} ${Date.now()}`); });
  const t0 = Date.now();
  await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  const tDom = Date.now() - t0;
  // espera o conteúdo real aparecer
  let ready = -1;
  for (let i = 0; i < 40; i++) {
    const txt = await p.evaluate(() => document.body?.innerText ?? "");
    if (!/Carregando/.test(txt) && txt.length > 150) { ready = Date.now() - t0; break; }
    await p.waitForTimeout(500);
  }
  const txt = await p.evaluate(() => document.body?.innerText ?? "");
  console.log(`${label.padEnd(10)} DOM=${tDom}ms pronto=${ready === -1 ? "NUNCA (30s+)" : ready + "ms"} | chars=${txt.length}`);
  if (apis.length) console.log("   APIs:", apis.join(" | "));
  if (ready === -1) console.log("   texto final:", txt.replace(/\n+/g, " | ").slice(0, 300));
  await p.close();
  await c.close();
}
await browser.close();
