// 1) Guarda de rotas (sem login) + 404s + páginas públicas, 3 viewports.
import { launch, visit, dump, BASE } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });

const routes = [
  ["/", "root"],
  ["/privacidade", "privacidade"],
  ["/login", "login"],
  ["/login/esqueci-senha", "esqueci-senha"],
  ["/motoboy/login", "motoboy-login"],
  ["/motoboy", "motoboy-sem-login"],
  ["/admin", "admin-sem-login"],
  ["/admin/lojas", "admin-lojas-sem-login"],
  ["/admin/configuracoes", "admin-config-sem-login"],
  ["/painel", "painel-sem-login"],
  ["/painel/pedidos", "painel-pedidos-sem-login"],
  ["/painel/pdv", "painel-pdv-sem-login"],
  ["/painel/entregas", "painel-entregas-sem-login"],
  ["/painel/cardapio", "painel-cardapio-sem-login"],
  ["/painel/clientes", "painel-clientes-sem-login"],
  ["/painel/configuracoes", "painel-config-sem-login"],
  ["/painel/whatsapp", "painel-whatsapp-sem-login"],
  ["/painel/financeiro", "painel-financeiro-sem-login"],
  ["/rota-que-nao-existe-xyz", "rota-404"],
  ["/loja-inexistente-abc", "loja-404"],
  ["/pizzariadasol", "loja-inativa"],
];

const rows = [];
for (const [url, label] of routes) {
  const r = await visit(ctx, url, label, { viewport: "desktop", wait: 2500 });
  rows.push(r);
  console.log(`${label.padEnd(28)} status=${r.status} -> ${r.finalUrl.replace(BASE, "")}`);
}
dump(rows);
fs.writeFileSync("qa/out/guard-routes.json", JSON.stringify(rows.map(r => ({ label: r.label, url: r.url, status: r.status, final: r.finalUrl, ms: r.ms })), null, 2));
await browser.close();
