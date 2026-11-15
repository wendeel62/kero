// Cria um pedido de ENTREGA (com coordenadas) pela vitrine p/ o mapa de entregas renderizar.
import { launch, BASE, SLUG, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await ctx.newPage();
await p.setViewportSize(VIEWPORTS.desktop);
p.on("response", async (r) => { if (r.url().includes("/api/") && (r.request().method() === "POST")) console.log(`  API ${r.status()} ${r.url().replace(BASE,"").slice(0,60)} ${(await r.text().catch(()=>"")).slice(0,150)}`); });
await p.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
await p.getByRole("button", { name: "Aceitar" }).click().catch(() => {});
await p.locator('button[aria-label="Adicionar pizzas tradicionais"]').click();
await p.waitForTimeout(1000);
await p.locator('.pdetail-option:has-text("Mussarela") input').check();
await p.waitForTimeout(400);
await p.locator(".pdetail-cta").click();
await p.waitForTimeout(900);
await p.locator(".cartbar").click();
await p.waitForTimeout(800);
await p.locator(".btn-finalizar-carrinho").click();
await p.waitForTimeout(2000);
await p.getByRole("radio", { name: /Entrega/ }).click();
await p.waitForTimeout(800);
await p.fill('input[placeholder="Seu nome completo"]', "QA Mapa Entrega");
await p.fill('input[placeholder="(11) 99999-9999"]', "92991532662");
await p.fill('input[placeholder="Rua, número..."]', "Avenida Eduardo Ribeiro");
await p.waitForTimeout(2500);
await p.fill('input[placeholder="00000-000"]', "69010000");
await p.waitForTimeout(1500);
await p.fill('input[placeholder="Número"]', "100");
await p.waitForTimeout(500);
// seleciona bairro
const sel = p.locator("select").first();
const opts = await sel.locator("option").allInnerTexts();
console.log("bairros:", opts);
await sel.selectOption({ label: /coroado/ }).catch(async () => { const v = await sel.locator("option").nth(1).getAttribute("value"); await sel.selectOption(v); });
await p.waitForTimeout(800);
await p.locator(".btn-mapa").first().click(); // buscar endereço no mapa
await p.waitForTimeout(9000);
console.log("texto checkout:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").match(/.{0,60}(Achamos|Arraste|pino|Busca|demora).{0,80}/gi)?.join(" || "));
console.log("total:", await p.evaluate(() => document.querySelector(".cta-total strong")?.textContent));
console.log("finalizar disabled:", await p.locator(".btn-finalizar").isDisabled());
await p.screenshot({ path: "qa-screenshots/pub-checkout-mapa.png", fullPage: true, scale: "css" });
await p.locator(".btn-finalizar").click();
await p.waitForTimeout(9000);
console.log("url final:", p.url().replace(BASE, ""));
console.log("texto final:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 400));
await browser.close();
