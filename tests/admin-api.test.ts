// SPEC §11 + §2.28 — 10 casos das rotas admin (stores + anonymize), contra o remoto.
// Sessão REAL (password grant) + mock SÓ do transporte de cookie (padrão D3).
// Admin de teste nasce via Auth Admin API (REGRA DE OURO M2) + role='admin'.
// Fixtures: lojas `loja-adm-${t}-*` (sweep no beforeAll, cascade leva o resto);
// teardown apaga lojas + users criados + asserts count 0.
try {
  process.loadEnvFile(".env.local"); // Node 22 stdlib — sem dotenv
} catch {}

import { createBrowserClient } from "@supabase/ssr";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { GET, PATCH, POST } from "@/app/api/admin/stores/route";
import { POST as ANON } from "@/app/api/admin/orders/[id]/anonymize/route";
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
const adminEmail = `admin-${t}@teste.local`;
const adminPass = "kero-admin-123!";
const phone = (n: number) => `92${String(t).slice(-8)}${n}`; // único por run
const ip = (n: number) => `203.0.113.${n}`; // único por pedido — isola rate limit
const OPEN = Object.fromEntries(
  [...Array(7)].map((_, d) => [String(d), [["00:00", "23:59"]]]),
);

let adminId = "";
let storePatch = "";
let storeAnon = "";
let orderAnon = "";
const userIds: string[] = []; // todos os users criados (admin + donos) p/ teardown

const get = (qs = "") => GET(new Request(`http://l/api/admin/stores${qs}`));
const post = (body: unknown) =>
  POST(
    new Request("http://l/api/admin/stores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const patch = (body: unknown) =>
  PATCH(
    new Request("http://l/api/admin/stores", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const anonPost = (id: string) =>
  ANON(new Request(`http://l/api/admin/orders/${id}/anonymize`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });

// Login isolado (jar próprio) — verifica senha sem sujar a sessão admin do teste.
const tryLogin = async (email: string, password: string) => {
  let j: Record<string, string> = {};
  const c = createBrowserClient(url, anon, {
    cookies: {
      getAll: () => Object.entries(j).map(([name, value]) => ({ name, value })),
      setAll: (all) => {
        j = {};
        all.forEach(({ name, value }) => (j[name] = value));
      },
    },
  });
  const r = await c.auth.signInWithPassword({ email, password });
  await c.auth.signOut();
  return r;
};

const ownerIdOf = async (storeId: string) => {
  const { data } = await db.from("profiles").select("id").eq("store_id", storeId).single();
  return data?.id as string;
};

const dropStoreAndOwner = async (storeId: string) => {
  const owner = await ownerIdOf(storeId).catch(() => "");
  if (storeId) await db.from("stores").delete().eq("id", storeId);
  if (owner) await db.auth.admin.deleteUser(owner);
};

beforeAll(async () => {
  // varre restos de runs abortadas — o cascade das FKs leva pedidos/produtos/bairros
  // ponytail: duas runs CONCORRENTES contra o mesmo remoto se espezinhariam; serializar.
  const sweep = await db.from("stores").delete().like("slug", "loja-adm-%");
  if (sweep.error) throw sweep.error;

  const created = await db.auth.admin.createUser({
    email: adminEmail,
    password: adminPass,
    email_confirm: true,
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("admin não criado");
  adminId = created.data.user.id;
  userIds.push(adminId);
  const upd = await db
    .from("profiles")
    .update({ role: "admin", store_id: null })
    .eq("id", adminId);
  if (upd.error) throw upd.error;

  const st = await db
    .from("stores")
    .insert({
      slug: `loja-adm-${t}-patch`,
      name: "Loja Admin Patch",
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
  storePatch = st.data.id;

  // Fixture do anonymize: loja 24/7 + produto + adicional + bairro + pedido cheio via RPC.
  const sa = await db
    .from("stores")
    .insert({
      slug: `loja-adm-${t}-anon`,
      name: "Loja Admin Anon",
      whatsapp: "92911117777",
      min_order_cents: 1000,
      prep_time_min: 20,
      prep_time_max: 40,
      open_hours: OPEN,
      active: true,
    })
    .select("id")
    .single();
  if (sa.error) throw sa.error;
  storeAnon = sa.data.id;

  const cat = await db
    .from("categories")
    .insert({ store_id: storeAnon, name: "Geral" })
    .select("id")
    .single();
  if (cat.error) throw cat.error;
  const prod = await db
    .from("products")
    .insert({ store_id: storeAnon, category_id: cat.data.id, name: "Pizza G", price_cents: 5500 })
    .select("id")
    .single();
  if (prod.error) throw prod.error;
  const addon = await db
    .from("product_addons")
    .insert({ store_id: storeAnon, product_id: null, name: "Bacon", price_cents: 1000 })
    .select("id")
    .single();
  if (addon.error) throw addon.error;
  const nb = await db
    .from("neighborhoods")
    .insert({ store_id: storeAnon, name: "Adrianópolis", fee_cents: 500 })
    .select("id")
    .single();
  if (nb.error) throw nb.error;

  const { data: token, error: rpcError } = await db.rpc("create_order", {
    p_store_id: storeAnon,
    p_type: "delivery",
    p_payment_method: "pix",
    p_change_for_cents: null,
    p_notes: "sem cebola, por favor",
    p_address: {
      neighborhood_id: nb.data.id,
      cep: "69000000",
      street: "Rua das Flores",
      number: "123",
      complement: "apto 4",
    },
    p_items: [{ id: prod.data.id, qty: 2, addons: [addon.data.id], notes: null }],
    p_total_cents: 13500, // (5500+1000)×2 + 500
    p_ip: ip(90),
    p_customer_name: "Fulano de Tal",
    p_customer_phone: phone(90),
  });
  if (rpcError) throw rpcError;
  const { data: ord, error: ordError } = await db
    .from("orders")
    .select("id")
    .eq("tracking_token", token as string)
    .single();
  if (ordError) throw ordError;
  orderAnon = ord.id;

  await client.auth.signOut();
});

afterAll(async () => {
  await db.from("stores").delete().like("slug", "loja-adm-%"); // cascade leva pedidos/itens
  for (const id of userIds) await db.auth.admin.deleteUser(id);
  await client.auth.signOut();
  const { count } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .like("slug", "loja-adm-%");
  console.log(`[teardown] lojas 'loja-adm-%' restantes no remoto: ${count}`);
  expect(count).toBe(0);
  const { count: profs } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("id", userIds);
  expect(profs).toBe(0); // users criados sumiram (cascade levou os profiles)
});

test("1. GET sem sessão → 401 UNAUTHORIZED", async () => {
  await client.auth.signOut();
  const res = await get();
  const body = await res.json();
  expect(res.status).toBe(401);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("2. GET sessão lojista → 401 fail closed (mesmo código)", async () => {
  const in1 = await client.auth.signInWithPassword({
    email: "lojista@pizza-do-joao.test",
    password: "kero1234",
  });
  expect(in1.error, "login do lojista falhou").toBeNull();
  const res = await get();
  const body = await res.json();
  expect(res.status).toBe(401);
  expect(body.error.code).toBe("UNAUTHORIZED");
  await client.auth.signOut();
});

test("3. GET admin → 200 lista com stores/page/per_page/total", async () => {
  const in1 = await client.auth.signInWithPassword({ email: adminEmail, password: adminPass });
  expect(in1.error, "login do admin falhou").toBeNull();
  const res = await get();
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(Array.isArray(body.stores)).toBe(true);
  expect(body.page).toBe(1);
  expect(body.per_page).toBe(50);
  expect(typeof body.total).toBe("number");
  expect(body.total).toBeGreaterThanOrEqual(1);
});

test("4. POST cria loja → 201 + login do dono com a provisória funciona", async () => {
  const slug = `loja-adm-${t}-a`;
  const email = `dono-${t}-a@teste.local`;
  const res = await post({ name: "Loja Admin A", slug, owner_email: email });
  const body = await res.json();
  expect(res.status).toBe(201);
  expect(body.store.slug).toMatch(/^[a-z0-9-]{3,40}$/);
  expect(body.store.active).toBe(false);
  expect(typeof body.password).toBe("string");
  expect(body.password).toHaveLength(12);
  userIds.push(await ownerIdOf(body.store.id));

  const { data: prof } = await db
    .from("profiles")
    .select("store_id")
    .eq("store_id", body.store.id)
    .single();
  expect(prof?.store_id).toBe(body.store.id);

  const login = await tryLogin(email, body.password);
  expect(login.error, "login do dono com a provisória falhou").toBeNull();

  await dropStoreAndOwner(body.store.id);
});

test("5. POST slug inválido → 400 INVALID_SLUG", async () => {
  const res = await post({ name: "X", slug: "Loja!!", owner_email: `dono-${t}-e@teste.local` });
  const body = await res.json();
  expect(res.status).toBe(400);
  expect(body.error.code).toBe("INVALID_SLUG");
});

test("6. POST email duplicado → 409 EMAIL_TAKEN sem loja órfã", async () => {
  const slug = `loja-adm-${t}-dup`;
  const res = await post({
    name: "Loja Admin Dup",
    slug,
    owner_email: "lojista@pizza-do-joao.test",
  });
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.error.code).toBe("EMAIL_TAKEN");
  const { count } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug);
  expect(count).toBe(0);
});

test("7. PATCH desativa loja → 200 active:false", async () => {
  const res = await patch({ id: storePatch, active: false });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body).toEqual({ ok: true, store: { id: storePatch, active: false } });
  const { data: st } = await db.from("stores").select("active").eq("id", storePatch).single();
  expect(st?.active).toBe(false);
});

test("8. PATCH reset_password → 200 + login com a nova senha funciona", async () => {
  const slug = `loja-adm-${t}-r`;
  const email = `dono-${t}-r@teste.local`;
  const created = await post({ name: "Loja Admin R", slug, owner_email: email });
  const cbody = await created.json();
  expect(created.status).toBe(201);
  userIds.push(await ownerIdOf(cbody.store.id));

  const res = await patch({ id: cbody.store.id, reset_password: true });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(typeof body.password).toBe("string");

  const login = await tryLogin(email, body.password);
  expect(login.error, "login com a nova senha falhou").toBeNull();

  await dropStoreAndOwner(cbody.store.id);
});

test("9. POST anonymize → PII zerada, itens/totais/status intactos", async () => {
  const before = await db
    .from("orders")
    .select("customer_name,customer_phone,address,notes,subtotal_cents,total_cents,status,anonymized_at")
    .eq("id", orderAnon)
    .single();
  const { data: itemsBefore } = await db
    .from("order_items")
    .select("name_snapshot,unit_price_cents,qty,addons,notes")
    .eq("order_id", orderAnon)
    .order("name_snapshot");
  expect(before.data?.anonymized_at).toBeNull();

  const res = await anonPost(orderAnon);
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(typeof body.anonymized_at).toBe("string");

  const { data: after } = await db
    .from("orders")
    .select("customer_name,customer_phone,address,notes,subtotal_cents,total_cents,status,anonymized_at")
    .eq("id", orderAnon)
    .single();
  expect(after?.customer_name).toBe("Cliente anonimizado");
  expect(after?.customer_phone).not.toBe(before.data?.customer_phone);
  expect(after?.customer_phone).toMatch(/^[0-9]{10,15}$/);
  expect(after?.address).toEqual({ neighborhood_name: "Adrianópolis" });
  expect(JSON.stringify(after?.address)).not.toContain("Rua das Flores");
  expect(JSON.stringify(after?.address)).not.toContain("69000000");
  expect(after?.notes).toBeNull();
  expect(after?.anonymized_at).toBeTruthy();
  expect(after?.subtotal_cents).toBe(before.data?.subtotal_cents);
  expect(after?.total_cents).toBe(before.data?.total_cents);
  expect(after?.status).toBe(before.data?.status);

  const { data: itemsAfter } = await db
    .from("order_items")
    .select("name_snapshot,unit_price_cents,qty,addons,notes")
    .eq("order_id", orderAnon)
    .order("name_snapshot");
  expect(itemsAfter).toEqual(itemsBefore);
});

test("10. anonymize idempotente → 2ª chamada 200 sem erro", async () => {
  const res = await anonPost(orderAnon);
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(typeof body.anonymized_at).toBe("string");
});
