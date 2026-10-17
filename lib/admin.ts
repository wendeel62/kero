// Leituras do operador (M6) — Server Actions via service role; sessão só autoriza.
// Mutações (criar, active, reset, anonimizar) vão por fetch nas rotas /api/admin/*
// (API-04, já testada) — aqui só leitura + agregados que a API não retorna.
"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import { manausDayStartISO } from "./painel-utils";
import { sanitizeLikeTerm } from "./admin-utils";

export type AdminStoreRow = {
  id: string; slug: string; name: string; active: boolean;
  ownerEmail: string; ordersToday: number; createdAt: string;
  lastOrderAt: string | null;
  plan: "basico" | "completo"; segment: string | null; adesaoPaidAt: string | null;
};

async function ownerEmails(storeIds: string[]): Promise<Map<string, string>> {
  const db = createAdminClient();
  const [{ data: profiles }, emails] = await Promise.all([
    db.from("profiles").select("id,store_id,created_at").in("store_id", storeIds)
      .eq("role", "loja").order("created_at", { ascending: true }),
    allUserEmails(),
  ]);
  const map = new Map<string, string>();
  for (const p of profiles ?? []) {
    // dono = profile loja mais antigo (mesma regra do detalhe)
    if (p.store_id && !map.has(p.store_id)) map.set(p.store_id, emails.get(p.id) ?? "");
  }
  return map;
}

// listUsers pagina em 50 — varre até esgotar em vez de truncar silencioso
async function allUserEmails(): Promise<Map<string, string>> {
  const db = createAdminClient();
  const map = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 50 });
    if (error) throw error;
    for (const u of data.users) map.set(u.id, u.email ?? "");
    if (data.users.length < 50) break;
    page++;
  }
  return map;
}

export async function getLojas(opts: { page: number; status: string; q: string }) {
  await requireAdmin();
  const db = createAdminClient();
  const PER_PAGE = 50;
  const page = Math.max(1, opts.page || 1);
  const from = (page - 1) * PER_PAGE;
  let query = db.from("stores").select("id,slug,name,active,created_at,plan,segment,adesao_paid_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (opts.status === "active") query = query.eq("active", true);
  else if (opts.status === "inactive") query = query.eq("active", false);
  const term = sanitizeLikeTerm(opts.q);
  if (term) query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  const { data: stores, count } = await query;
  const ids = (stores ?? []).map((s) => s.id);
  // contagem só das lojas da página (não varre o dia inteiro de todas as lojas)
  const [{ data: today }, emails, { data: allOrders }] = await Promise.all([
    ids.length > 0
      ? db.from("orders").select("store_id").in("store_id", ids).gte("created_at", manausDayStartISO())
      : Promise.resolve({ data: [] as { store_id: string }[] }),
    ownerEmails(ids),
    ids.length > 0
      ? db.from("orders").select("store_id, created_at").in("store_id", ids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { store_id: string; created_at: string }[] }),
  ]);
  const perStore = new Map<string, number>();
  for (const o of today ?? []) perStore.set(o.store_id, (perStore.get(o.store_id) ?? 0) + 1);
  const lastOrder = new Map<string, string>();
  for (const o of allOrders ?? [])
    if (!lastOrder.has(o.store_id)) lastOrder.set(o.store_id, o.created_at);
  return {
    stores: ((stores ?? []) as { id: string; slug: string; name: string; active: boolean; created_at: string; plan?: string | null; segment?: string | null; adesao_paid_at?: string | null }[])
      .map((s): AdminStoreRow => ({
        id: s.id, slug: s.slug, name: s.name, active: s.active,
        ownerEmail: emails.get(s.id) ?? "—", ordersToday: perStore.get(s.id) ?? 0,
        createdAt: new Date(s.created_at).toLocaleDateString("pt-BR"),
        lastOrderAt: lastOrder.get(s.id)
          ? new Date(lastOrder.get(s.id)!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
          : null,
        plan: s.plan === "completo" ? "completo" : "basico",
        segment: s.segment ?? null,
        adesaoPaidAt: s.adesao_paid_at ?? null,
      })),
    page, per_page: PER_PAGE, total: count ?? 0,
  };
}

export async function getAdminStats() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ count: stores }, { count: active }, { count: ordersToday }] = await Promise.all([
    db.from("stores").select("id", { count: "exact", head: true }),
    db.from("stores").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("orders").select("id", { count: "exact", head: true }).gte("created_at", manausDayStartISO()),
  ]);
  return { stores: stores ?? 0, active: active ?? 0, ordersToday: ordersToday ?? 0 };
}

export type AdminOrderRow = {
  id: string; code: string; customer: string; minutesAgo: number; date: string;
  type: "delivery" | "pickup"; payment: string; total_cents: number;
  status: string; anonymized: boolean;
};

export async function getLoja(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  const start = manausDayStartISO();
  const { data: store } = await db.from("stores")
    .select("id,slug,name,active,whatsapp,created_at,plan,segment,adesao_paid_at").eq("id", id).single();
  if (!store) return { loja: null as null };
  const [{ data: owner }, { data: orders }, { data: today }] = await Promise.all([
    db.from("profiles").select("id").eq("store_id", id).eq("role", "loja")
      .order("created_at", { ascending: true }).limit(1).maybeSingle(),
    db.from("orders").select("id,code,customer_name,type,payment_method,total_cents,status,created_at,anonymized_at")
      .eq("store_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("orders").select("total_cents,status").eq("store_id", id).gte("created_at", start),
  ]);
  let ownerEmail = "—";
  if (owner) {
    const { data: user } = await db.auth.admin.getUserById(owner.id);
    ownerEmail = user?.user?.email ?? "—";
  }
  const pay: Record<string, string> = { cash: "Dinheiro", pix: "Pix", card_machine: "Maquininha" };
  const now = Date.now();
  const list = ((orders ?? []) as {
    id: string; code: string; customer_name: string; type: "delivery" | "pickup";
    payment_method: string; total_cents: number; status: string; created_at: string; anonymized_at: string | null;
  }[]).map((o): AdminOrderRow => ({
    id: o.id, code: o.code, customer: o.customer_name, type: o.type,
    payment: pay[o.payment_method] ?? o.payment_method, total_cents: o.total_cents,
    status: o.status, anonymized: !!o.anonymized_at,
    date: new Date(o.created_at).toLocaleDateString("pt-BR"),
    minutesAgo: Math.max(0, Math.round((now - new Date(o.created_at).getTime()) / 60000)),
  }));
  const dayValid = ((today ?? []) as { total_cents: number; status: string }[])
    .filter((o) => o.status !== "cancelled");
  return {
    loja: {
      id: store.id as string, slug: store.slug as string, name: store.name as string,
      active: store.active as boolean, whatsapp: store.whatsapp as string,
      createdAt: new Date(store.created_at as string).toLocaleDateString("pt-BR"),
      plan: ((store as { plan?: string }).plan === "completo" ? "completo" : "basico") as "basico" | "completo",
      segment: ((store as { segment?: string | null }).segment ?? null) as string | null,
      adesaoPaidAt: ((store as { adesao_paid_at?: string | null }).adesao_paid_at ?? null) as string | null,
      ownerEmail,
      stats: {
        orders: dayValid.length,
        revenue: dayValid.reduce((s, o) => s + o.total_cents, 0),
      },
      orders: list,
    },
  };
}
