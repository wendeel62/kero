// SPEC §2.22/§2.29 — 5 casos da rota cron POST/GET /api/cron/daily-salt, contra o remoto.
// Sem sessão (é cron): handler direto, sem mocks. RPCs security definer via admin client.
// Fixture de pedido direto (insert com created_at retroagido 25h) segue o padrão do D3.
try {
  process.loadEnvFile(".env.local"); // Node 22 stdlib — sem dotenv
} catch {}

import { afterAll, beforeAll, expect, test } from "vitest";

import { GET, POST } from "@/app/api/cron/daily-salt/route";
import { createAdminClient } from "@/lib/supabase/admin";

const db = createAdminClient();
const t = Date.now();
const OPEN = Object.fromEntries(
  [...Array(7)].map((_, d) => [String(d), [["00:00", "23:59"]]]),
);
// code ^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$ (001): sem 0/1/I/L/O
const code = () =>
  [...Array(4)].map(() => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
const todayManaus = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const post = (headers?: Record<string, string>) =>
  POST(new Request("http://l/api/cron/daily-salt", { method: "POST", headers }));

let storeId = "";
let staleOrderId = "";

beforeAll(async () => {
  // varre restos de runs abortadas — o cascade das FKs leva os pedidos
  // ponytail: duas runs CONCORRENTES contra o mesmo remoto se espezinhariam; serializar.
  const sweep = await db.from("stores").delete().like("slug", "loja-teste-cr-%");
  if (sweep.error) throw sweep.error;
});

afterAll(async () => {
  if (storeId) await db.from("stores").delete().eq("id", storeId); // cascade → pedido stale
  const { count } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .like("slug", "loja-teste-cr-%");
  console.log(`[teardown] lojas 'loja-teste-cr-%' restantes no remoto: ${count}`);
  expect(count).toBe(0);
});

test("1. chamada cria linha do dia → 200 {ok, day, auto_cancelled}", async () => {
  const res = await post();
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.day).toBe(todayManaus());
  expect(body.ok).toBe(true);
  expect(typeof body.auto_cancelled).toBe("number");
  expect(body.auto_cancelled).toBeGreaterThanOrEqual(0);
  const { data: row, error } = await db
    .from("daily_salt")
    .select("day,salt")
    .eq("day", todayManaus())
    .single();
  expect(error).toBeNull();
  expect(row?.salt).toBeTruthy();
});

test("2. idempotente: segunda chamada (GET) → 200 e uma única linha p/ hoje", async () => {
  const res = await GET(new Request("http://l/api/cron/daily-salt"));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body).toMatchObject({ ok: true, day: todayManaus() });
  const { data, error } = await db.from("daily_salt").select("day").eq("day", todayManaus());
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
});

test("3. auto-cancel real: pedido new com 25h vira cancelled system/timeout_24h", async () => {
  const st = await db
    .from("stores")
    .insert({
      slug: `loja-teste-cr-${t}`,
      name: "Loja Teste Cron",
      whatsapp: "92911116666",
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

  const ins = await db
    .from("orders")
    .insert({
      store_id: storeId,
      code: code(),
      customer_name: "Cliente Teste Cron",
      customer_phone: `92${String(t).slice(-8)}3`,
      type: "pickup",
      payment_method: "pix",
      subtotal_cents: 1000,
      delivery_fee_cents: 0,
      total_cents: 1000,
      promised_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      status: "new",
    })
    .select("id")
    .single();
  if (ins.error) throw ins.error;
  staleOrderId = ins.data.id;

  const backdate = await db
    .from("orders")
    .update({ created_at: new Date(Date.now() - 25 * 3_600_000).toISOString() })
    .eq("id", staleOrderId);
  if (backdate.error) throw backdate.error;

  const res = await post();
  expect(res.status).toBe(200);
  const { data: order, error } = await db
    .from("orders")
    .select("status,canceled_by,cancellation_reason")
    .eq("id", staleOrderId)
    .single();
  expect(error).toBeNull();
  expect(order).toMatchObject({
    status: "cancelled",
    canceled_by: "system",
    cancellation_reason: "timeout_24h",
  });
});

test("4. gate desligado → 200 {ok, skipped} sem chamar RPCs", async () => {
  const prev = process.env.DAILY_SALT_ROTATION_ENABLED;
  process.env.DAILY_SALT_ROTATION_ENABLED = "false";
  try {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: true });
  } finally {
    process.env.DAILY_SALT_ROTATION_ENABLED = prev;
  }
});

test("5. porta do secret: sem header → 401; com Bearer → 200", async () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "s3cr3t";
  try {
    const denied = await post();
    const deniedBody = await denied.json();
    expect(denied.status).toBe(401);
    expect(deniedBody.error.code).toBe("UNAUTHORIZED");
    const allowed = await post({ authorization: "Bearer s3cr3t" });
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).ok).toBe(true);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});
