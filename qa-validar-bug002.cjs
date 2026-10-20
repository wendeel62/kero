// Valida BUG-002: cupom de impressão (entrega e retirada) via Playwright.
const { chromium } = require("playwright");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const R = {};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // login
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email", { timeout: 30000 });
  await page.fill("#email", "lojista.qa@teste.local");
  await page.fill("#senha", "QAloja2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/painel/, { timeout: 30000 });
  console.log("logado:", page.url());

  // pedidos de teste
  const { data:peds } = await db.from("orders").select("id,code,type,tracking_token").eq("store_id", "cda9a418-1995-4c6f-86db-cc112fdd3def").order("created_at");
  const entrega = peds.find((p) => p.type === "delivery");
  const retirada = peds.find((p) => p.type === "pickup");

  // cupom do pedido de entrega
  await page.goto(`http://localhost:3000/painel/pedidos/${entrega.id}/print`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".cupom", { timeout: 30000 });
  const cupomEntrega = await page.evaluate(() => {
    const c = document.querySelector(".cupom");
    return {
      texto: c?.innerText,
      temEndereco: /Rua das Flores/.test(c?.innerText || ""),
      temBairro: /Centro/.test(c?.innerText || ""),
      temCep: /01001000/.test(c?.innerText || ""),
      linkAcompanhe: c?.innerText.match(/Acompanhe: (\S+)/)?.[1] || null,
      mm: c ? Math.round(c.getBoundingClientRect().width / 96 * 25.4) : null,
    };
  });
  R.cupomEntrega = cupomEntrega;
  await page.screenshot({ path: "/tmp/opencode/qa/shots/bug002-cupom-entrega.png", fullPage: true });

  // cupom do pedido de retirada
  await page.goto(`http://localhost:3000/painel/pedidos/${retirada.id}/print`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".cupom", { timeout: 30000 });
  const cupomRetirada = await page.evaluate(() => {
    const c = document.querySelector(".cupom");
    return {
      texto: c?.innerText,
      temEndereco: /Rua das Flores/.test(c?.innerText || ""),
      temRetirada: /RETIRADA/.test(c?.innerText || ""),
    };
  });
  R.cupomRetirada = cupomRetirada;
  await page.screenshot({ path: "/tmp/opencode/qa/shots/bug002-cupom-retirada.png", fullPage: true });

  fs.writeFileSync("/tmp/opencode/qa/bug002-validacao.json", JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})();
