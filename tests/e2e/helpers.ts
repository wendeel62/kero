// Fixtures do e2e: loja própria por run (slug único, sempre aberta) + teardown em cascade.
// Roda contra a base apontada por E2E_* (CI: stack local; nunca o remoto de verdade).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

export type E2EStore = {
  slug: string; storeId: string; productId: string; price: number;
};

const STATE = "tests/e2e/.store.json";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SERVICE_ROLE_KEY!;

export const db = () =>
  createClient(url, serviceKey, { auth: { persistSession: false } });

const OPEN = Object.fromEntries(
  [...Array(7)].map((_, d) => [String(d), [["00:00", "23:59"]]]),
);

export async function createE2EStore(): Promise<E2EStore> {
  const t = Date.now();
  const slug = `loja-e2e-${t}`;
  const client = db();
  const { data: store, error: sErr } = await client
    .from("stores")
    .insert({
      slug, name: "Loja E2E", whatsapp: "92911119999", min_order_cents: 1000,
      prep_time_min: 20, prep_time_max: 40, open_hours: OPEN, active: true,
    })
    .select("id")
    .single();
  if (sErr || !store) throw sErr ?? new Error("store insert falhou");
  const { data: cat } = await client.from("categories")
    .insert({ store_id: store.id, name: "Geral" }).select("id").single();
  if (!cat) throw new Error("category insert falhou");
  const { data: prod } = await client.from("products")
    .insert({ store_id: store.id, category_id: cat.id, name: "Produto E2E", price_cents: 5000 })
    .select("id").single();
  if (!prod) throw new Error("product insert falhou");
  const st: E2EStore = { slug, storeId: store.id, productId: prod.id, price: 5000 };
  fs.writeFileSync(STATE, JSON.stringify(st));
  return st;
}

export async function deleteE2EStore() {
  if (!fs.existsSync(STATE)) return;
  const st = JSON.parse(fs.readFileSync(STATE, "utf8")) as E2EStore;
  const { error } = await db().from("stores").delete().eq("id", st.storeId);
  if (error) throw error;
  fs.rmSync(STATE);
}

export function readE2EStore(): E2EStore {
  return JSON.parse(fs.readFileSync(STATE, "utf8")) as E2EStore;
}

// telefone único por teste — dedup 60s não vaza entre cenários
export const e2ePhone = (n: number) => `9299${String(Date.now()).slice(-6)}${n}`.slice(0, 11);
