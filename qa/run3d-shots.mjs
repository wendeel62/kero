// 3d) Screenshots com conteúdo carregado (desktop full-page + mobile).
import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
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
for (const [url, label] of routes) {
  for (const vp of ["desktop", "mobile"]) {
    const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS[vp], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const p = await c.newPage();
    await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
    for (let i = 0; i < 30; i++) {
      const t = await p.evaluate(() => document.body?.innerText ?? "");
      if (!/Carregando/.test(t) && t.length > 150) break;
      await p.waitForTimeout(400);
    }
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `qa-screenshots/${label}-${vp}.png`, fullPage: vp === "desktop", scale: "css" });
    console.log(`${label}-${vp} ok`);
    await p.close();
    await c.close();
  }
}
await browser.close();
