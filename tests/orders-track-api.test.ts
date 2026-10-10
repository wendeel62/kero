// SPEC §12 — 6 casos da rota pública GET/POST /api/orders/track/[token], contra o remoto.
// Sem sessão: handler direto, sem mocks (padrão D2). Fixture via RPC create_order
// (dados realistas: nome, phone único, endereço completo, 1 item com adicional).
try {
  process.loadEnvFile(".env.local"); // Node 22 stdlib — sem dotenv
} catch {}

import { afterAll, beforeAll, expect, test } from "vitest";

import { GET, POST } from "@/app/api/orders/track/[token]/route";
import { createAdminClient } from "@/lib/supabase/admin";

const db = createAdminClient();
const t = Date.now();
const phone = (n: number) => `92${String(t).slice(-8)}${n}`; // único por run — dedup 60s não vaza
const ip = (n: number) => `203.0.113.${n}`; // único por pedido — isola rate limit
const OPEN = Object.fromEntries(
  [...Array(7)].map((_, d) => [String(d), [["00:00", "23:59"]]]),
);

const FEE = 500;
const TOTAL = (5500 + 1000) * 2 + FEE; // 13500 — unit já soma o adicional (002 l.448)

let storeId = "";
let prodId = "";
let addonId = "";
let nbId = "";
let tokenA = ""; // fluxo feliz GET + cancel
let tokenB = ""; // avançado até delivered (caso 4)
let tokenC = ""; // motivo curto (caso 5)

const mkOrder = (n: number) => ({
  p_store_id: storeId,
  p_type: "delivery",
  p_payment_method: "pix",
  p_change_for_cents: null,
  p_notes: "sem cebola visível",
  p_address: {
    neighborhood_id: nbId,
    cep: "69000000",
    street: "Rua das Flores",
    number: "123",
    complement: "apto 4",
  },
  p_items: [{ id: prodId, qty: 2, addons: [addonId], notes: null }],
  p_total_cents: TOTAL,
  p_ip: ip(n),
  p_customer_name: "Ana",
  p_customer_phone: phone(n),
});

const createOrder = async (n: number) => {
  const { data, error } = await db.rpc("create_order", mkOrder(n));
  if (error) throw error;
  return data as string;
};

const get = (token: string) =>
  GET(new Request(`http://l/api/orders/track/${token}`), {
    params: Promise.resolve({ token }),
  });

const post = (token: string, body: unknown) =>
  POST(
    new Request(`http://l/api/orders/track/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ token }) },
  );

beforeAll(async () => {
  // varre restos de runs abortadas — o cascade das FKs leva pedidos/itens/eventos
  // ponytail: duas runs CONCORRENTES contra o mesmo remoto se espezinhariam; serializar.
  const sweep = await db.from("stores").delete().like("slug", "loja-teste-tr-%");
  if (sweep.error) throw sweep.error;

  const st = await db
    .from("stores")
    .insert({
      slug: `loja-teste-tr-${t}`,
      name: "Loja Teste Track",
      whatsapp: "92911115555",
      min_order_cents: 1000,
      prep_time_min: 20,
      prep_time_max: 40,
      open_hours: OPEN,
      active: true,
    })
    .select("id")
    .single();
  if (st.error) throw st.error;
  storeId = st.data.id;

  const cat = await db
    .from("categories")
    .insert({ store_id: storeId, name: "Geral" })
    .select("id")
    .single();
  if (cat.error) throw cat.error;

  const prod = await db
    .from("products")
    .insert({ store_id: storeId, category_id: cat.data.id, name: "Margherita G", price_cents: 5500 })
    .select("id")
    .single();
  if (prod.error) throw prod.error;
  prodId = prod.data.id;

  const addon = await db
    .from("product_addons")
    .insert({ store_id: storeId, product_id: null, name: "Bacon", price_cents: 1000 })
    .select("id")
    .single();
  if (addon.error) throw addon.error;
  addonId = addon.data.id;

  const nb = await db
    .from("neighborhoods")
    .insert({ store_id: storeId, name: "Adrianópolis", fee_cents: FEE })
    .select("id")
    .single();
  if (nb.error) throw nb.error;
  nbId = nb.data.id;

  tokenA = await createOrder(1);
  tokenB = await createOrder(2);
  tokenC = await createOrder(3);
});

afterAll(async () => {
  if (storeId) await db.from("stores").delete().eq("id", storeId); // cascade leva o resto
  const { count } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .like("slug", "loja-teste-tr-%");
  console.log(`[teardown] lojas 'loja-teste-tr-%' restantes no remoto: ${count}`);
  expect(count).toBe(0);
});

test("1. GET feliz → 200 mascarado (sem rua/número/CEP/fone cheio/token)", async () => {
  const res = await get(tokenA);
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  expect(body.status).toBe("new");
  expect(body.phone_masked).toBe(`••••••${phone(1).slice(-2)}`);
  expect(body.phone_masked).not.toContain(phone(1));
  const raw = JSON.stringify(body);
  expect(raw).not.toContain(phone(1));
  expect(raw).not.toContain("Rua das Flores");
  expect(raw).not.toContain("69000000");
  expect(raw).not.toContain(tokenA);
  for (const k of ["street", "number", "cep", "tracking_token", "customer_phone", "ip_hash"])
    expect(raw).not.toContain(`"${k}"`);
  expect(body.customer_name).toBe("Ana");
  expect(body.notes).toBe("sem cebola visível");
  expect(body.neighborhood).toBe("Adrianópolis");
  expect(body.items).toEqual([
    {
      name: "Margherita G",
      qty: 2,
      unit_price_cents: 6500,
      addons: [{ name: "Bacon", price_cents: 1000 }],
      notes: null,
    },
  ]);
  expect(body.subtotal_cents).toBe(13000);
  expect(body.delivery_fee_cents).toBe(FEE);
  expect(body.total_cents).toBe(TOTAL);
  expect(body.promised_at).toBeTruthy();
  expect(body.canCancel).toBe(true);
  expect(body.cancellation_reason).toBeNull();
});

test("2. GET token inexistente → 404 ORDER_NOT_FOUND", async () => {
  const res = await get(crypto.randomUUID());
  const body = await res.json();
  expect(res.status).toBe(404);
  expect(body.error.code).toBe("ORDER_NOT_FOUND");
});

test("3. POST cancel feliz → 200 + linha cancelled/canceled_by + GET reflete", async () => {
  const res = await post(tokenA, { reason: "mudou de ideia" });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body).toEqual({ ok: true, status: "cancelled" });

  const { data: order } = await db
    .from("orders")
    .select("status,canceled_by,cancellation_reason")
    .eq("tracking_token", tokenA)
    .single();
  expect(order).toMatchObject({
    status: "cancelled",
    canceled_by: "customer",
    cancellation_reason: "mudou de ideia",
  });

  const g = await get(tokenA);
  const gb = await g.json();
  expect(g.status).toBe(200);
  expect(gb.status).toBe("cancelled");
  expect(gb.cancellation_reason).toBe("mudou de ideia");
  expect(gb.canCancel).toBe(false);
});

test("4. POST fora da janela (delivered) → 400 CANCEL_NOT_ALLOWED", async () => {
  const { data: order } = await db
    .from("orders")
    .select("id")
    .eq("tracking_token", tokenB)
    .single();
  for (const s of ["confirmed", "preparing", "out", "delivered"]) {
    const { error } = await db.rpc("set_order_status", {
      p_order_id: order!.id,
      p_to: s,
      p_reason: null,
      p_actor: "system",
    });
    if (error) throw error;
  }
  const res = await post(tokenB, { reason: "mudou de ideia" });
  const body = await res.json();
  expect(res.status).toBe(400);
  expect(body.error.code).toBe("CANCEL_NOT_ALLOWED");
});

test("5. POST motivo curto → 400 REASON_REQUIRED", async () => {
  const res = await post(tokenC, { reason: "ok" });
  const body = await res.json();
  expect(res.status).toBe(400);
  expect(body.error.code).toBe("REASON_REQUIRED");
});

test("6. POST token inexistente → 404 ORDER_NOT_FOUND", async () => {
  const res = await post(crypto.randomUUID(), { reason: "mudou de ideia" });
  const body = await res.json();
  expect(res.status).toBe(404);
  expect(body.error.code).toBe("ORDER_NOT_FOUND");
});
