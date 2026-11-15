import { launch, visit, report } from "./qa-audit.mjs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });

const routes = [
  ["/", "root"],
  ["/pizzariadokbc", "store"],
  ["/privacidade", "privacidade"],
  ["/login", "login"],
  ["/login/esqueci-senha", "esqueci-senha"],
  ["/loja-inexistente-xyz", "store-404"],
  ["/rota/que/nao/existe", "rota-404"],
  ["/painel", "painel-sem-login"],
  ["/painel/pedidos", "painel-pedidos-sem-login"],
  ["/painel/cardapio", "painel-cardapio-sem-login"],
  ["/painel/configuracoes", "painel-config-sem-login"],
  ["/painel/financeiro", "painel-financeiro-sem-login"],
  ["/painel/clientes", "painel-clientes-sem-login"],
  ["/painel/entregas", "painel-entregas-sem-login"],
  ["/painel/whatsapp", "painel-whatsapp-sem-login"],
  ["/painel/pdv", "painel-pdv-sem-login"],
  ["/motoboy", "motoboy-sem-login"],
  ["/motoboy/login", "motoboy-login"],
  ["/admin", "admin-sem-login"],
  ["/admin/lojas", "admin-lojas-sem-login"],
  ["/admin/configuracoes", "admin-config-sem-login"],
];

const rows = [];
for (const [url, label] of routes) {
  rows.push(await visit(ctx, url, label, { viewport: "desktop" }));
}
report(rows);
await browser.close();
