// SPEC §12 — rotas /api/whatsapp/* (status, connect, qr, disconnect).
// Sessões REAIS de dois lojistas (lojas A e B, REMOTE) + mock SÓ do transporte de
// cookie; o WAHA inteiro é mocked (o teste é do transporte, não do WAHA).
// Provas: 401 sem sessão; body envenenado com store_id alheio NUNCA muda a sessão.
try {
  process.loadEnvFile(".env.local"); // Node 22 stdlib — sem dotenv
} catch {}

import { createBrowserClient } from "@supabase/ssr";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { POST as connectPost } from "@/app/api/whatsapp/connect/route";
import { POST as disconnectPost } from "@/app/api/whatsapp/disconnect/route";
import { GET as qrGet } from "@/app/api/whatsapp/qr/route";
import { GET as statusGet } from "@/app/api/whatsapp/status/route";
import { createAdminClient } from "@/lib/supabase/admin";

const WEBHOOK = "http://n8n.test/webhook/kero"; // só o teste precisa; o env real é de produção
process.env.WHATSAPP_WEBHOOK_URL = WEBHOOK;

const h = vi.hoisted(() => {
  const statuses = new Map<string, { status: string; me: string | null }>();
  const calls: Array<{ fn: string; session: string; webhookUrl?: string }> = [];
  const reset = () => (calls.length = 0);
  return { statuses, calls, reset };
});

vi.mock("@/lib/waha", () => ({
  sessionName: (id: string) => `kero_${id}`,
  statusSessao: async (session: string) => {
    h.calls.push({ fn: "statusSessao", session });
    return h.statuses.get(session) ?? { status: "STOPPED", me: null };
  },
  criarSessao: async (storeId: string, webhookUrl: string) => {
    h.calls.push({ fn: "criarSessao", session: `kero_${storeId}`, webhookUrl });
    return h.statuses.get(`kero_${storeId}`) ?? { status: "SCAN_QR_CODE", me: null };
  },
  qrCode: async (session: string) => {
    h.calls.push({ fn: "qrCode", session });
    return "QRBASE64";
  },
  desconectar: async (session: string) => {
    h.calls.push({ fn: "desconectar", session });
    return true;
  },
}));

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
const PASS = "kero-wa-123!";
const emailA = `lojista-wa-a-${t}@teste.local`;
const emailB = `lojista-wa-b-${t}@teste.local`;
const OPEN = Object.fromEntries(
  [...Array(7)].map((_, d) => [String(d), [["00:00", "23:59"]]]),
);
const userIds: string[] = [];

let storeA = "";
let storeB = "";
let sessionA = "";
let sessionB = "";

const req = (path: string, body?: unknown) =>
  new Request(`http://l/api/whatsapp/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const signIn = async (email: string) => {
  const r = await client.auth.signInWithPassword({ email, password: PASS });
  if (r.error) throw r.error;
};

const createOwner = async (email: string, storeId: string) => {
  const created = await db.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("user não criado");
  userIds.push(created.data.user.id);
  const upd = await db.from("profiles").update({ store_id: storeId }).eq("id", created.data.user.id);
  if (upd.error) throw upd.error;
};

beforeAll(async () => {
  // varre restos de runs abortadas — cascade leva profiles/produtos/bairros
  // ponytail: duas runs CONCORRENTES contra o mesmo remoto se espezinhariam; serializar.
  const sweep = await db.from("stores").delete().like("slug", "loja-wa-%");
  if (sweep.error) throw sweep.error;

  const sts = await db
    .from("stores")
    .insert([
      {
        slug: `loja-wa-a-${t}`,
        name: "Loja WA A",
        whatsapp: "92911117777",
        min_order_cents: 1000,
        prep_time_min: 20,
        prep_time_max: 40,
        open_hours: OPEN,
        active: true,
      },
      {
        slug: `loja-wa-b-${t}`,
        name: "Loja WA B",
        whatsapp: "92911118888",
        min_order_cents: 1000,
        prep_time_min: 20,
        prep_time_max: 40,
        open_hours: OPEN,
        active: true,
      },
    ])
    .select("id,slug");
  if (sts.error) throw sts.error;
  storeA = sts.data.find((s) => s.slug === `loja-wa-a-${t}`)!.id;
  storeB = sts.data.find((s) => s.slug === `loja-wa-b-${t}`)!.id;
  sessionA = `kero_${storeA}`;
  sessionB = `kero_${storeB}`;

  await createOwner(emailA, storeA);
  await createOwner(emailB, storeB);

  h.statuses.set(sessionA, { status: "WORKING", me: "559299990001" });
  h.statuses.set(sessionB, { status: "STOPPED", me: null });

  await client.auth.signOut();
});

afterAll(async () => {
  await db.from("stores").delete().like("slug", "loja-wa-%");
  for (const id of userIds) await db.auth.admin.deleteUser(id);
  await client.auth.signOut();
  const { count } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .like("slug", "loja-wa-%");
  console.log(`[teardown] lojas 'loja-wa-%' restantes no remoto: ${count}`);
  expect(count).toBe(0);
});

test("1. sem sessão → 401 UNAUTHORIZED nas 4 rotas", async () => {
  for (const r of [
    await statusGet(req("status")),
    await connectPost(req("connect", {})),
    await qrGet(req("qr")),
    await disconnectPost(req("disconnect", {})),
  ]) {
    const body = await r.json();
    expect(r.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  }
  expect(h.calls, "nada foi chamado no WAHA").toEqual([]);
});

test("2. status do lojista A → sessão A, nunca a de B", async () => {
  h.reset();
  await signIn(emailA);
  const res = await statusGet(req("status"));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body).toEqual({ status: "WORKING", phone: "559299990001" });
  expect(h.calls).toEqual([{ fn: "statusSessao", session: sessionA }]);
});

test("3. connect com body envenenado (store_id de B) → cria sessão A", async () => {
  h.reset();
  const res = await connectPost(req("connect", { store_id: storeB }));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(h.calls.every((c) => c.session === sessionA), "só sessão A").toBe(true);
  expect(h.calls[0].fn).toBe("criarSessao");
  expect(h.calls[0].webhookUrl).toBe(WEBHOOK);
  expect(body.status).toBe("WORKING");
});

test("4. qr com body envenenado → QR da sessão A", async () => {
  h.reset();
  const res = await qrGet(req("qr", { store_id: storeB }));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.qr).toBe("QRBASE64");
  expect(h.calls).toEqual([{ fn: "qrCode", session: sessionA }]);
});

test("5. disconnect com body envenenado → desconecta a PRÓPRIA sessão A", async () => {
  h.reset();
  const res = await disconnectPost(req("disconnect", { store_id: storeB, session: sessionB }));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body).toEqual({ ok: true });
  expect(h.calls).toEqual([{ fn: "desconectar", session: sessionA }]);
});

test("6. status do lojista B → sessão B (STOPPED), nunca a de A", async () => {
  h.reset();
  await signIn(emailB);
  const res = await statusGet(req("status"));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body).toEqual({ status: "STOPPED", phone: null });
  expect(h.calls).toEqual([{ fn: "statusSessao", session: sessionB }]);
  expect(body.status, "status de A nunca vaza p/ B").not.toBe("WORKING");
});
