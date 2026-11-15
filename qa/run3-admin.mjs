// 3) Área admin (lojista): login + varredura de TODAS as rotas /painel em 3 viewports.
import { launch, visit, dump, login, BASE } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });

console.log("=== LOGIN ===");
const { finalUrl, text, state } = await login(ctx);
console.log("url após login:", finalUrl);
console.log("texto:", text.replace(/\n+/g, " | ").slice(0, 400));

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

const rows = [];
for (const vp of ["desktop", "mobile"]) {
  for (const [url, label] of routes) {
    const r = await visit(ctx, url, `${label}-${vp}`, { viewport: vp, wait: 3000, storageState: state, full: vp === "desktop" });
    rows.push(r);
    const c = r.bag.console.length, n = r.bag.net.length;
    console.log(`${label}-${vp}`.padEnd(26) + ` status=${r.status} url=${r.finalUrl.replace(BASE, "")} ovf=${r.info?.overflowX} console=${c} net=${n}`);
    if (c) console.log("   CONSOLE:", JSON.stringify(r.bag.console.slice(0, 4)));
    if (n) console.log("   NET:", JSON.stringify(r.bag.net.slice(0, 6)));
    if (r.info?.overflowers?.length) console.log("   OVERFLOW:", JSON.stringify(r.info.overflowers.slice(0, 5)));
    if (r.info?.brokenImgs?.length) console.log("   BROKEN IMG:", JSON.stringify(r.info.brokenImgs));
  }
}

// tablet: só as principais
for (const [url, label] of [["/painel", "adm-hoje"], ["/painel/pedidos", "adm-pedidos"], ["/painel/cardapio", "adm-cardapio"], ["/painel/configuracoes", "adm-config"], ["/painel/whatsapp", "adm-whatsapp"], ["/painel/entregas", "adm-entregas"]]) {
  const r = await visit(ctx, url, `${label}-tablet`, { viewport: "tablet", wait: 3000, storageState: state });
  rows.push(r);
  console.log(`${label}-tablet`.padEnd(26) + ` status=${r.status} ovf=${r.info?.overflowX} console=${r.bag.console.length} net=${r.bag.net.length}`);
  if (r.info?.overflowers?.length) console.log("   OVERFLOW:", JSON.stringify(r.info.overflowers.slice(0, 5)));
}

dump(rows);
fs.writeFileSync("qa/out/admin-crawl.json", JSON.stringify(rows.map(r => ({ label: r.label, url: r.url, status: r.status, final: r.finalUrl, ms: r.ms, console: r.bag.console, net: r.bag.net, api: r.bag.api, overflowX: r.info?.overflowX, over: r.info?.overflowers, tiny: r.info?.tinyTargets, text: r.info?.text?.slice(0, 2500) })), null, 2));
await browser.close();
