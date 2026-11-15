// 3b) Admin: varredura com espera suficiente p/ os dados carregarem.
import { launch, visit, dump, login, BASE } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const { finalUrl, state } = await login(ctx);
console.log("login →", finalUrl);

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

// warmup: compila as rotas (dev) para não medir compilação como lentidão
console.log("warmup...");
for (const [url] of routes) {
  const p = await ctx.newPage();
  await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.close();
}

const rows = [];
for (const vp of ["desktop", "tablet", "mobile"]) {
  for (const [url, label] of routes) {
    const r = await visit(ctx, url, `${label}-${vp}`, { viewport: vp, wait: 7000, storageState: state, full: vp === "desktop" });
    rows.push(r);
    const carregando = /Carregando/.test(r.info?.text ?? "");
    console.log(`${label}-${vp}`.padEnd(26) + ` status=${r.status} ms=${r.ms} ovf=${r.info?.overflowX} (${r.info?.scrollW}/${r.info?.clientW}) carregando=${carregando} console=${r.bag.console.length} net=${r.bag.net.length}`);
    if (r.bag.console.length) console.log("   CONSOLE:", JSON.stringify(r.bag.console.slice(0, 3).map(c => c.text.slice(0, 200))));
    if (r.info?.overflowers?.length) console.log("   OVERFLOW:", JSON.stringify(r.info.overflowers.slice(0, 4)));
    if (r.info?.brokenImgs?.length) console.log("   BROKEN IMG:", JSON.stringify(r.info.brokenImgs));
  }
}

dump(rows);
fs.writeFileSync("qa/out/admin-crawl.json", JSON.stringify(rows.map(r => ({ label: r.label, url: r.url, status: r.status, ms: r.ms, console: r.bag.console, net: r.bag.net, api: r.bag.api, overflowX: r.info?.overflowX, over: r.info?.overflowers, tiny: r.info?.tinyTargets, noLabel: r.info?.inputsWithoutLabel, btns: r.info?.btns, links: r.info?.links, inputs: r.info?.inputs, tables: r.info?.tables, text: r.info?.text })), null, 2));
await browser.close();
