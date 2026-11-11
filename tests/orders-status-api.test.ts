// SPEC §6 — 5 casos da rota PATCH /api/orders/[id]/status, contra o remoto.
// Sessão REAL de lojista (password grant); só o transporte de cookie de
// `@/lib/supabase/server` é mockado. createBrowserClient fora do browser
// exige cookie adapter → jar in-memory (o "cookie" do lojista durante a run).
// Toda a regra (ator, posse, máquina, motivo) é do RPC set_order_status (002).
// Fixture 100% hermético: 2 lojas de teste + 1 lojista próprios da run
// (criados via service_role) — nunca a loja demo do remoto, que é mutável.
try {
  process.loadEnvFile(".env.local"); // Node 22 stdlib — sem dotenv
} catch {}

import { createBrowserClient } from "@supabase/ssr";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { PATCH } from "@/app/api/orders/[id]/status/route";
import { createAdminClient } from "@/lib/supabase/admin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
let jar: Record<string, string> = {};
const client = createBrowserClient(url, anon, {
  cookies: {
    getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
    setAll: (all) => {
      jar = {};
      all.forEach(({ name, value }) => (jar[name] = value));
    },
  },
});

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));

const db = createAdminClient();
const t = Date.now();
const OPEN = Object.fromEntries(
  [...Array(7)].map((_, d) => [String(d), [["00:00", "23:59"]]]),
);
// code ^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$ (001): sem 0/1/I/L/O
const code = () =>
  [...Array(4)].map(() => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");

const patch = (id: string, body: unknown) =>
  PATCH(
    new Request(`http://l/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

let storeOwn = "";
let storeForeign = "";
let userId = "";
const OWNER_EMAIL_PREFIX = "lojista-st-";
let orderOwn = ""; // pedido na loja do lojista (casos 2/3/5)
let orderForeign = ""; // pedido em loja alheia (caso 4)

beforeAll(async () => {
  // varre restos de runs abortadas — o cascade das FKs leva pedidos/eventos
  // ponytail: duas runs CONCORRENTES contra o mesmo remoto se espezinhariam; serializar.
  const sweep = await db.from("stores").delete().like("slug", "loja-teste-st-%");
  if (sweep.error) throw sweep.error;
  // usuários de runs abortadas (email único no auth)
  const users = await db.auth.admin.listUsers({ perPage: 100 });
  if (users.error) throw users.error;
  for (const u of users.data.users) {
    if (u.email?.startsWith(OWNER_EMAIL_PREFIX)) {
      const del = await db.auth.admin.deleteUser(u.id);
      if (del.error) throw del.error;
    }
  }

  const [own, foreign] = await Promise.all([
    db
      .from("stores")
      .insert({
        slug: `loja-teste-st-${t}-own`,
        name: "Loja Teste Status",
        whatsapp: "92911114444",
        min_order_cents: 1000,
        prep_time_min: 20,
        prep_time_max: 40,
        open_hours: OPEN,
        active: true,
      })
      .select("id")
      .single(),
    db
      .from("stores")
      .insert({
        slug: `loja-teste-st-${t}-foreign`,
        name: "Loja Teste Alheia",
        whatsapp: "92911115555",
        min_order_cents: 1000,
        prep_time_min: 20,
        prep_time_max: 40,
        open_hours: OPEN,
        active: true,
      })
      .select("id")
      .single(),
  ]);
  if (own.error) throw own.error;
  if (foreign.error) throw foreign.error;
  storeOwn = own.data.id;
  storeForeign = foreign.data.id;

  // lojista de teste: usuário auth real + profile apontando para a loja própria
  // (auth_store_id() = profiles.store_id — é isso que o RPC valida)
  const owner = await db.auth.admin.createUser({
    email: `${OWNER_EMAIL_PREFIX}${t}@kero.test`,
    password: "kero-st-1234",
    email_confirm: true,
  });
  if (owner.error) throw owner.error;
  userId = owner.data.user!.id;
  // o trigger 005 já criou o profile (role 'loja') — só ligar à loja própria
  const prof = await db.from("profiles").update({ store_id: storeOwn }).eq("id", userId).select("id").single();
  if (prof.error) throw prof.error;

  const orders = await db
    .from("orders")
    .insert([
      {
        store_id: storeOwn, // loja do lojista de teste — casos 2/3/5
        code: code(),
        customer_name: "Cliente Teste Status",
        customer_phone: `92${String(t).slice(-8)}1`,
        type: "pickup",
        payment_method: "pix",
        subtotal_cents: 1000,
        delivery_fee_cents: 0,
        total_cents: 1000,
        promised_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        status: "new",
      },
      {
        store_id: storeForeign, // loja alheia — caso 4
        code: code(),
        customer_name: "Cliente Teste Status",
        customer_phone: `92${String(t).slice(-8)}2`,
        type: "pickup",
        payment_method: "pix",
        subtotal_cents: 1000,
        delivery_fee_cents: 0,
        total_cents: 1000,
        promised_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        status: "new",
      },
    ])
    .select("id,store_id");
  if (orders.error) throw orders.error;
  orderOwn = orders.data.find((o) => o.store_id === storeOwn)!.id;
  orderForeign = orders.data.find((o) => o.store_id === storeForeign)!.id;

  const in1 = await client.auth.signInWithPassword({
    email: `${OWNER_EMAIL_PREFIX}${t}@kero.test`,
    password: "kero-st-1234",
  });
  if (in1.error) throw in1.error;
});

afterAll(async () => {
  if (userId) await db.auth.admin.deleteUser(userId);
  await client.auth.signOut();
  if (storeForeign) await db.from("stores").delete().eq("id", storeForeign);
  if (storeOwn) await db.from("stores").delete().eq("id", storeOwn); // cascade → pedidos
  const { count } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .like("slug", "loja-teste-st-%");
  console.log(`[teardown] lojas 'loja-teste-st-%' restantes no remoto: ${count}`);
  expect(count).toBe(0);
  const { count: ordersLeft } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_name", "Cliente Teste Status");
  expect(ordersLeft).toBe(0);
});

test("1. sem sessão → 401 UNAUTHORIZED (signOut antes; re-login depois)", async () => {
  await client.auth.signOut();
  const res = await patch(orderOwn, { status: "confirmed" });
  const body = await res.json();
  expect(res.status).toBe(401);
  expect(body.error.code).toBe("UNAUTHORIZED");
  const in1 = await client.auth.signInWithPassword({
    email: `${OWNER_EMAIL_PREFIX}${t}@kero.test`,
    password: "kero-st-1234",
  });
  expect(in1.error, "re-login do lojista falhou").toBeNull();
});

test("2. transição inválida new→delivered → 400 INVALID_TRANSITION", async () => {
  const res = await patch(orderOwn, { status: "delivered" });
  const body = await res.json();
  expect(res.status).toBe(400);
  expect(body.error.code).toBe("INVALID_TRANSITION");
});

test("3. new→confirmed válido → 200 {ok,status} + order_events gravado (actor=store)", async () => {
  const res = await patch(orderOwn, { status: "confirmed" });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body).toEqual({ ok: true, status: "confirmed" });
  const { data: events } = await db
    .from("order_events")
    .select("from_status,to_status,actor")
    .eq("order_id", orderOwn);
  expect(events).toEqual([{ from_status: "new", to_status: "confirmed", actor: "store" }]);
});

test("4. pedido da loja de TESTE, sessão do lojista da DEMO → 403 NOT_YOUR_STORE", async () => {
  const res = await patch(orderForeign, { status: "confirmed" });
  const body = await res.json();
  expect(res.status).toBe(403);
  expect(body.error.code).toBe("NOT_YOUR_STORE");
});

test("5. cancel sem motivo (reason vazia) → 400 REASON_REQUIRED", async () => {
  const res = await patch(orderOwn, { status: "cancelled", reason: "" });
  const body = await res.json();
  expect(res.status).toBe(400);
  expect(body.error.code).toBe("REASON_REQUIRED");
});
