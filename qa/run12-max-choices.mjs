// 12) Verifica a troca silenciosa de seleção quando o limite de escolhas é atingido.
// Cria (via service role, dados de teste) um grupo com 3 opções e max=2 na loja de teste.
import { createClient } from "@supabase/supabase-js";
import { launch, BASE, SLUG, VIEWPORTS } from "./lib.mjs";
import fs from "fs";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#")).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SID = "5751a74b-5feb-41be-be14-6c3967ca1383";

const { data: g } = await sb.from("product_addon_groups").insert({ store_id: SID, name: "QA 3 Sabores", required: true, max_choices: 2, min_choices: 1, sort_order: 99, price_rule: "sum" }).select().single();
console.log("grupo:", g.id);
const ops = [];
for (const n of ["Opção A", "Opção B", "Opção C"]) {
  const { data: a } = await sb.from("product_addons").insert({ store_id: SID, name: n, price_cents: 0, active: true, group_id: g.id }).select().single();
  ops.push(a.id);
}
console.log("opções:", ops.join(","));

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await ctx.newPage();
await p.setViewportSize(VIEWPORTS.desktop);
await p.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
await p.evaluate(() => { const b = [...document.querySelectorAll('[data-testid="cookie-banner"] button')].find(x => /recusar/i.test(x.innerText)); b?.click(); });
await p.waitForTimeout(600);
await p.locator('button[aria-label="Adicionar x-salada"]').click();
await p.waitForTimeout(1200);
console.log("instrução do grupo:", await p.evaluate(() => [...document.querySelectorAll(".pdetail-group-sub")].map(e => e.textContent).join(" / ")));
const nomes = ["Opção A", "Opção B", "Opção C"];
for (const n of nomes) { await p.locator(`.pdetail-option:has-text("${n}") input`).check(); await p.waitForTimeout(500); }
const estado = await p.evaluate(() => [...document.querySelectorAll(".pdetail-option")].map(o => `${o.querySelector(".pdetail-option-name")?.textContent.trim()}=${o.querySelector("input")?.checked}`));
console.log("estado após marcar A, B, C (max=2):", JSON.stringify(estado));
console.log("CTA habilitado?", await p.locator(".pdetail-cta").isDisabled() === false);
console.log("subtítulo exibido:", await p.evaluate(() => [...document.querySelectorAll(".pdetail-group-sub")].map(e => e.textContent).join(" / ")));
await p.screenshot({ path: "qa-screenshots/bug-max-choices-troca.png", fullPage: false, scale: "css" });
// cleanup
await sb.from("product_addons").delete().in("id", ops);
await sb.from("product_addon_groups").delete().eq("id", g.id);
console.log("cleanup ok");
await browser.close();
