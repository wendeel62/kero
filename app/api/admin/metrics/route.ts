import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

// Métricas do admin SaaS (Task 2).
// Sem autenticação própria: o middleware já protege; este handler só usa o service_role.
const DAY_MS = 24 * 60 * 60 * 1000;

// Janela ancorada no relógio local de America/Manaus. Manaus não observa
// horário de verão, portanto "agora - 30 dias" no fuso local é este mesmo instante.
const AGORA = new Date();
const DESDE_30D = new Date(AGORA.getTime() - 30 * DAY_MS).toISOString();
const DESDE_60D = new Date(AGORA.getTime() - 60 * DAY_MS).toISOString();

const toNum = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export async function GET() {
  const admin = createAdminClient();

  try {
    // GMV todo o tempo, apenas delivered (agregado em JS: PostgREST não
    // aceita sum() no select desta versão).
    const { data: gmvRows, error: e1 } = await admin
      .from("orders")
      .select("total_cents")
      .eq("status", "delivered");
    if (e1) return apiError("UNEXPECTED", `Falha ao calcular GMV: ${e1.message}`, 500);
    const gmv_cents = ((gmvRows as unknown as Array<Record<string, unknown>>) ?? []).reduce(
      (s, o) => s + toNum(o.total_cents),
      0,
    );

    // Pedidos nos últimos 30 dias (todos os status). Ler platform_fee_cents aqui;
    // se a coluna da Task 1 não existir, o Postgres rejeita e devolvemos 500 descritivo.
    const { data: rows30, error: e2 } = await admin
      .from("orders")
      .select("store_id, total_cents, platform_fee_cents, status")
      .gte("created_at", DESDE_30D);
    if (e2) return apiError("UNEXPECTED", `Falha ao ler pedidos: ${e2.message}`, 500);

    const orders30 = (rows30 as unknown as Array<Record<string, unknown>>) ?? [];
    const delivered30 = orders30.filter((o) => o.status === "delivered");
    const cancelled30 = orders30.filter((o) => o.status === "cancelled");

    const gmv_cents_30d = delivered30.reduce((s, o) => s + toNum(o.total_cents), 0);
    const platform_fee_cents_30d = delivered30.reduce((s, o) => s + toNum(o.platform_fee_cents), 0);
    const total_orders_30d = orders30.length;
    const delivered_orders_30d = delivered30.length;
    const cancelled_orders_30d = cancelled30.length;
    const avg_order_value_cents =
      delivered_orders_30d > 0 ? gmv_cents_30d / delivered_orders_30d : 0;

    // Lojas (count exact via head: PostgREST não aceita count(*) no select).
    const { count: stores_total, error: e3 } = await admin
      .from("stores")
      .select("id", { count: "exact", head: true });
    if (e3) return apiError("UNEXPECTED", `Falha ao contar lojas: ${e3.message}`, 500);

    const { count: stores_active, error: e4 } = await admin
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (e4) return apiError("UNEXPECTED", `Falha ao contar lojas ativas: ${e4.message}`, 500);

    // Churn: delivered em [60d, 30d) atrás, mas não em [30d, agora).
    const { data: prev, error: e5 } = await admin
      .from("orders")
      .select("store_id")
      .eq("status", "delivered")
      .gte("created_at", DESDE_60D)
      .lt("created_at", DESDE_30D);
    if (e5) return apiError("UNEXPECTED", `Falha ao calcular churn: ${e5.message}`, 500);
    const prevSet = new Set(
      (prev as unknown as Array<Record<string, unknown>> ?? [])
        .map((o) => o.store_id)
        .filter(Boolean),
    );
    const currSet = new Set(delivered30.map((o) => o.store_id).filter(Boolean));
    const churn_lojas_30d = [...prevSet].filter((id) => !currSet.has(id)).length;

    // Top 5 lojas por GMV nos últimos 30 dias.
    const byStore = new Map<
      string,
      { gmv_cents: number; orders_count: number }
    >();
    for (const o of delivered30) {
      const id = o.store_id;
      if (!id) continue;
      const cur = byStore.get(id as string) ?? { gmv_cents: 0, orders_count: 0 };
      cur.gmv_cents += toNum(o.total_cents);
      cur.orders_count += 1;
      byStore.set(id as string, cur);
    }
    const top5 = [...byStore.entries()]
      .sort((a, b) => b[1].gmv_cents - a[1].gmv_cents)
      .slice(0, 5)
      .map(([store_id]) => ({ store_id, ...byStore.get(store_id)! }));

    let stores: Array<Record<string, unknown>> = [];
    if (top5.length) {
      const { data: sData, error: e6 } = await admin
        .from("stores")
        .select("id, name")
        .in("id", top5.map((t) => t.store_id));
      if (e6) return apiError("UNEXPECTED", `Falha ao buscar nomes das lojas: ${e6.message}`, 500);
      stores = sData ?? [];
    }
    const byName = new Map(stores.map((s) => [s.id, s.name]));
    const top_stores = top5.map((t) => ({
      store_id: t.store_id,
      store_name: byName.get(t.store_id) ?? null,
      gmv_cents: t.gmv_cents,
      orders_count: t.orders_count,
    }));

    return NextResponse.json({
      gmv_cents,
      gmv_cents_30d,
      total_orders_30d,
      delivered_orders_30d,
      cancelled_orders_30d,
      avg_order_value_cents,
      platform_fee_cents_30d,
      stores_active: stores_active ?? 0,
      stores_total: stores_total ?? 0,
      churn_lojas_30d,
      top_stores,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado.";
    return apiError("UNEXPECTED", `Erro ao calcular métricas: ${message}`, 500);
  }
}
