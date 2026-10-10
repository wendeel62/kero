// SPEC §10 — 13 casos da rota POST /api/orders, contra o Supabase remoto (service role).
// Fixture: lojas de teste dedicadas (slug único por run, sempre abertas 00:00–23:59 —
// horário de Manaus não flaka); teardown apaga as lojas e o cascade leva o resto.
// Happy path: 2× Produto A (500) + adicional global (100) cobrado POR UNIDADE (002 l.448):
// (500+100)×2 + taxa 300 = 1500.
try {
  process.loadEnvFile(".env.local"); // Node 22 stdlib — sem dotenv
} catch {}

import { afterAll, beforeAll, expect, test } from "vitest";
import { POST } from "@/app/api/orders/route";
import { createAdminClient } from "@/lib/supabase/admin";

const db = createAdminClient();
const t = Date.now();
const phone = (n: number) => `92${String(t).slice(-8)}${n}`; // único por run — dedup 60s não vaza
const ip = (n: number) => `203.0.113.${n}`; // único por caso — isola rate limit (hash por IP)
const rateIp = `198.51.100.${(t % 200) + 10}`; // dedicado ao caso 4
const OPEN = Object.fromEntries(
  [...Array(7)].map((_, d) => [String(d), [["00:00", "23:59"]]]),
);

let store1 = "";
let store2 = "";
let prodA = "";
let prodB = "";
let addonId = "";
let nb1 = "";

const post = (payload: Record<string, unknown>, ipAddr: string) =>
  POST(
    new Request("http://l/orders", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ipAddr },
      body: JSON.stringify(payload),
    }),
  );

const happy = (over: Record<string, unknown> = {}) => ({
  store_id: store1,
  customer_name: "Cliente Teste",
  customer_phone: phone(1),
  type: "delivery",
  payment_method: "pix",
  change_for_cents: null,
  notes: null,
  address: {
    neighborhood_id: nb1,
    cep: "69000000",
    street: "Rua Teste",
    number: "100",
    complement: null,
  },
  items: [{ id: prodA, qty: 2, addons: [addonId], notes: null }],
  total_cents: 1500,
  website: "",
  confirmedPriceDiff: false,
  ...over,
});

beforeAll(async () => {
  // varre restos de runs abortadas — o cascade das FKs leva pedidos/produtos/bairros
  // ponytail: duas runs CONCORRENTES contra o mesmo remoto se espezinhariam; serializar.
  const sweep = await db.from("stores").delete().like("slug", "loja-teste-api-%");
  if (sweep.error) throw sweep.error;

  const stores = await db
    .from("stores")
    .insert([
      {
        slug: `loja-teste-api-${t}`,
        name: "Loja Teste API",
        whatsapp: "92911112222",
        min_order_cents: 1000,
        prep_time_min: 20,
        prep_time_max: 40,
        open_hours: OPEN,
        active: true,
      },
      {
        slug: `loja-teste-api-2-${t}`, // sem bairros (caso 7)
        name: "Loja Teste API 2",
        whatsapp: "92911113333",
        min_order_cents: 1000,
        prep_time_min: 20,
        prep_time_max: 40,
        open_hours: OPEN,
        active: true,
      },
    ])
    .select("id,slug");
  if (stores.error) throw stores.error;
  store1 = stores.data.find((s) => s.slug === `loja-teste-api-${t}`)!.id;
  store2 = stores.data.find((s) => s.slug === `loja-teste-api-2-${t}`)!.id;

  const cat = await db
    .from("categories")
    .insert({ store_id: store1, name: "Geral" })
    .select("id")
    .single();
  if (cat.error) throw cat.error;

  const prods = await db
    .from("products")
    .insert([
      { store_id: store1, category_id: cat.data.id, name: "Produto A", price_cents: 500 },
      { store_id: store1, category_id: cat.data.id, name: "Produto B", price_cents: 700 },
    ])
    .select("id,name");
  if (prods.error) throw prods.error;
  prodA = prods.data.find((p) => p.name === "Produto A")!.id;
  prodB = prods.data.find((p) => p.name === "Produto B")!.id;

  const addon = await db
    .from("product_addons")
    .insert({ store_id: store1, product_id: null, name: "Adicional Extra", price_cents: 100 })
    .select("id")
    .single();
  if (addon.error) throw addon.error;
  addonId = addon.data.id;

  const nbs = await db
    .from("neighborhoods")
    .insert([
      { store_id: store1, name: "Centro", fee_cents: 300 },
      { store_id: store1, name: "Distante", fee_cents: 800 },
    ])
    .select("id,name");
  if (nbs.error) throw nbs.error;
  nb1 = nbs.data.find((n) => n.name === "Centro")!.id;
});

afterAll(async () => {
  if (store1) await db.from("stores").delete().eq("id", store1);
  if (store2) await db.from("stores").delete().eq("id", store2);
  const { count } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .like("slug", "loja-teste-api-%");
  console.log(`[teardown] lojas 'loja-teste-api-%' restantes no remoto: ${count}`);
  expect(count).toBe(0);
});

test("1. total adulterado é ignorado → 409 PRICE_CHANGED", async () => {
  const res = await post(happy({ customer_phone: phone(1), total_cents: 999 }), ip(1));
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.error.code).toBe("PRICE_CHANGED");
});

test("2. PRICE_CHANGED carrega original_total/corrected_total inteiros", async () => {
  const res = await post(happy({ customer_phone: phone(2), total_cents: 999 }), ip(2));
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.original_total).toBe(999);
  expect(body.corrected_total).toBe(1500); // (500+100)×2 + 300 — adicional por unidade
});

test("3. dedup: 2º pedido mesmo telefone <60s → 409 DUPLICATE sem token", async () => {
  const p = phone(31);
  const first = await post(happy({ customer_phone: p }), ip(3));
  expect(first.status).toBe(201);
  const res = await post(happy({ customer_phone: p }), ip(3));
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.error.code).toBe("DUPLICATE");
  expect("tracking_token" in body).toBe(false);
});

test("4. rate limit: 6º pedido do mesmo IP em 1h → 429 RATE_LIMIT", async () => {
  const payload = (n: number) =>
    happy({
      customer_phone: phone(40 + n),
      type: "pickup",
      address: null,
      items: [{ id: prodA, qty: 2, addons: [], notes: null }],
      total_cents: 1000,
    });
  for (let i = 1; i <= 5; i++) {
    const res = await post(payload(i), rateIp);
    expect(res.status, `pedido ${i} deve entrar`).toBe(201);
  }
  const res = await post(payload(9), rateIp);
  const body = await res.json();
  expect(res.status).toBe(429);
  expect(body.error.code).toBe("RATE_LIMIT");
});

test("5. item indisponível → 422 (inexistente genérico; pausado com nome)", async () => {
  const res = await post(
    happy({
      customer_phone: phone(51),
      items: [{ id: crypto.randomUUID(), qty: 1, addons: [], notes: null }],
      total_cents: 500,
    }),
    ip(5),
  );
  const body = await res.json();
  expect(res.status).toBe(422);
  expect(body.error.code).toBe("ITEM_UNAVAILABLE");
  expect(body.error.message).toBe("Item indisponível.");

  try {
    const upd = await db.from("products").update({ active: false }).eq("id", prodB);
    if (upd.error) throw upd.error;
    const res2 = await post(
      happy({
        customer_phone: phone(52),
        type: "pickup",
        address: null,
        items: [{ id: prodB, qty: 1, addons: [], notes: null }],
        total_cents: 700,
      }),
      ip(5),
    );
    const body2 = await res2.json();
    expect(res2.status).toBe(422);
    expect(body2.error.code).toBe("ITEM_UNAVAILABLE");
    expect(body2.error.message).toContain("Produto B");
  } finally {
    await db.from("products").update({ active: true }).eq("id", prodB);
  }
});

test("6. force_closed → 409 STORE_CLOSED", async () => {
  try {
    const upd = await db.from("stores").update({ force_closed: true }).eq("id", store1);
    if (upd.error) throw upd.error;
    const res = await post(happy({ customer_phone: phone(61) }), ip(6));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error.code).toBe("STORE_CLOSED");
  } finally {
    await db.from("stores").update({ force_closed: false }).eq("id", store1);
  }
});

test("7. delivery em loja sem bairros ativos → 422 BAIRROS_NAO_CONFIGURADOS", async () => {
  const res = await post(happy({ store_id: store2, customer_phone: phone(71) }), ip(7));
  const body = await res.json();
  expect(res.status).toBe(422);
  expect(body.error.code).toBe("BAIRROS_NAO_CONFIGURADOS");
});

test("8. honeypot preenchido → 400 HONEYPOT", async () => {
  const res = await post(happy({ website: "spam" }), ip(8));
  const body = await res.json();
  expect(res.status).toBe(400);
  expect(body.error.code).toBe("HONEYPOT");
});

test("9. subtotal abaixo do mínimo da loja → 422 MIN_ORDER", async () => {
  const res = await post(
    happy({
      customer_phone: phone(91),
      items: [{ id: prodA, qty: 1, addons: [], notes: null }],
      total_cents: 800, // 1×500 + taxa 300 = correto; subtotal 500 < mínimo 1000
    }),
    ip(9),
  );
  const body = await res.json();
  expect(res.status).toBe(422);
  expect(body.error.code).toBe("MIN_ORDER");
});

test("10. pix sem troco → 201 com tracking_token uuid", async () => {
  const res = await post(happy({ customer_phone: phone(101) }), ip(10));
  const body = await res.json();
  expect(res.status).toBe(201);
  expect(body.tracking_token).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
});

test("11. sucesso grava promised_at (+30min ±2) e ip_hash (64 hex)", async () => {
  const res = await post(happy({ customer_phone: phone(111) }), ip(11));
  const body = await res.json();
  expect(res.status).toBe(201);
  const { data: order } = await db
    .from("orders")
    .select("promised_at, ip_hash")
    .eq("tracking_token", body.tracking_token)
    .single();
  expect(order?.promised_at).toBeTruthy();
  const deltaMin =
    Math.abs(new Date(order!.promised_at).getTime() - (Date.now() + 30 * 60_000)) / 60_000;
  expect(deltaMin).toBeLessThanOrEqual(2); // ceil((20+40)/2) = 30min
  expect(order?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
});

test("12. delivery sem CEP → 422 INVALID_CEP", async () => {
  const res = await post(
    happy({
      customer_phone: phone(121),
      address: { neighborhood_id: nb1, street: "Rua Teste", number: "100" },
    }),
    ip(12),
  );
  const body = await res.json();
  expect(res.status).toBe(422);
  expect(body.error.code).toBe("INVALID_CEP");
});

test("13. CEP com traço ('69000-000') → 422 INVALID_CEP", async () => {
  const res = await post(
    happy({
      customer_phone: phone(131),
      address: { neighborhood_id: nb1, cep: "69000-000", street: "Rua Teste", number: "100", complement: null },
    }),
    ip(13),
  );
  const body = await res.json();
  expect(res.status).toBe(422);
  expect(body.error.code).toBe("INVALID_CEP");
});
