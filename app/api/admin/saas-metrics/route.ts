import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireAdminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Métricas SaaS do dono (MRR, adesão, churn, ativação, CAC, coortes, segmentos).
// Agregações em JS após selects enxutos (PostgREST desta versão não aceita
// sum()/count(*) no select; counts via { count: "exact", head: true }).
// Loja ativa = >=1 pedido NÃO-cancelado nos últimos 30 dias (delivered e
// demais status operacionais contam; cancelled não indica uso real).
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 1000;

type StoreRow = {
  id: string;
  plan: string;
  segment: string | null;
  adesao_paid_at: string | null;
  active: boolean;
  created_at: string;
};

type OrderRow = { store_id: string; status: string; created_at: string };

// America/Manaus é UTC-4 fixo (sem DST): meia-noite local = 04:00Z do mesmo dia.
function manausYMD(d: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

function monthStartUTCISO(now: Date): { iso: string; y: number; m: number } {
  const { y, m } = manausYMD(now);
  return { iso: new Date(Date.UTC(y, m - 1, 1, 4, 0, 0)).toISOString(), y, m };
}

async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mkQuery: (from: number, to: number) => any,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await mkQuery(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function GET() {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);
  const admin = createAdminClient();

  try {
    const agora = new Date();
    const desde30d = new Date(agora.getTime() - 30 * DAY_MS).toISOString();
    const desde60d = new Date(agora.getTime() - 60 * DAY_MS).toISOString();
    const { iso: mesInicioISO, y: mesY, m: mesM } = monthStartUTCISO(agora);

    const { data: settingsRows, error: eSettings } = await admin
      .from("saas_settings")
      .select("key,value");
    if (eSettings) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
    const settingsMap = new Map(
      ((settingsRows ?? []) as Array<{ key: string; value: number }>).map((r) => [
        r.key,
        Number(r.value),
      ]),
    );
    const settings = {
      plan_basico: settingsMap.get("plan_basico") ?? 0,
      plan_completo: settingsMap.get("plan_completo") ?? 0,
      adesao_fee: settingsMap.get("adesao_fee") ?? 0,
      ad_spend_daily: settingsMap.get("ad_spend_daily") ?? 0,
    };

    const stores = await fetchAll<StoreRow>((from, to) =>
      admin
        .from("stores")
        .select("id,plan,segment,adesao_paid_at,active,created_at")
        .order("created_at", { ascending: true })
        .range(from, to),
    );
    const validOrders = await fetchAll<OrderRow>((from, to) =>
      admin
        .from("orders")
        .select("store_id,created_at")
        .neq("status", "cancelled")
        .gte("created_at", desde60d)
        .order("created_at", { ascending: true })
        .range(from, to),
    );
    // Primeiro pedido de cada loja (p/ ativação 7d): só 2 colunas, agregado em JS.
    const allFirsts = await fetchAll<OrderRow>((from, to) =>
      admin
        .from("orders")
        .select("store_id,created_at")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true })
        .range(from, to),
    );
    const firstByStore = new Map<string, string>();
    for (const o of allFirsts) {
      if (o.store_id && !firstByStore.has(o.store_id)) firstByStore.set(o.store_id, o.created_at);
    }

    const isRecent = (iso: string) => iso >= desde30d;
    const recentSet = new Set(
      validOrders.filter((o) => isRecent(o.created_at)).map((o) => o.store_id),
    );
    const prevSet = new Set(
      validOrders.filter((o) => !isRecent(o.created_at)).map((o) => o.store_id),
    );

    // MRR só sobre stores active=true.
    const activeStores = stores.filter((s) => s.active);
    const basicoCount = activeStores.filter((s) => s.plan !== "completo").length;
    const completoCount = activeStores.filter((s) => s.plan === "completo").length;
    const basicoValue = basicoCount * settings.plan_basico;
    const completoValue = completoCount * settings.plan_completo;

    const adesaoCount = stores.filter(
      (s) => s.adesao_paid_at && s.adesao_paid_at >= mesInicioISO,
    ).length;

    const novasLojasMes = stores.filter((s) => s.created_at >= mesInicioISO).length;

    // Ativação: lojas criadas há >=7 dias cujo 1º pedido não-cancelado
    // ocorreu em até 7 dias após stores.created_at.
    const ativaveis = stores.filter(
      (s) => agora.getTime() - new Date(s.created_at).getTime() >= 7 * DAY_MS,
    );
    const ativadas = ativaveis.filter((s) => {
      const first = firstByStore.get(s.id);
      if (!first) return false;
      return (
        new Date(first).getTime() - new Date(s.created_at).getTime() <= 7 * DAY_MS
      );
    });

    // Coortes: últimos 6 meses (calendário Manaus), retidas = >=1 pedido não-cancelado nos últimos 30d.
    const coortes = Array.from({ length: 6 }, (_, i) => {
      const idx = mesM - 1 - i;
      const y = mesY + Math.floor(idx / 12);
      const m = ((idx % 12) + 12) % 12 + 1;
      const key = monthKey(y, m);
      const novas = stores.filter((s) => {
        const p = manausYMD(new Date(s.created_at));
        return p.y === y && p.m === m;
      });
      return {
        mes: key,
        novas: novas.length,
        retidas: novas.filter((s) => recentSet.has(s.id)).length,
      };
    }).reverse();

    // Segmentos ordenados por pedidos_30d desc.
    const pedidos30PorLoja = new Map<string, number>();
    for (const o of validOrders) {
      if (!isRecent(o.created_at)) continue;
      pedidos30PorLoja.set(o.store_id, (pedidos30PorLoja.get(o.store_id) ?? 0) + 1);
    }
    const segMap = new Map<string, { lojas: number; pedidos_30d: number }>();
    for (const s of stores) {
      const seg = s.segment?.trim() ? s.segment!.trim() : "sem segmento";
      const cur = segMap.get(seg) ?? { lojas: 0, pedidos_30d: 0 };
      cur.lojas += 1;
      cur.pedidos_30d += pedidos30PorLoja.get(s.id) ?? 0;
      segMap.set(seg, cur);
    }
    const segmentos = [...segMap.entries()]
      .map(([segment, v]) => ({ segment, ...v }))
      .sort((x, y) => y.pedidos_30d - x.pedidos_30d);

    return NextResponse.json({
      mrr: basicoValue + completoValue,
      mrr_by_plan: {
        basico: { count: basicoCount, value: basicoValue },
        completo: { count: completoCount, value: completoValue },
      },
      adesao_revenue_month: adesaoCount * settings.adesao_fee,
      lojas_ativas: recentSet.size,
      lojas_total: stores.length,
      churn_30d: [...prevSet].filter((id) => !recentSet.has(id)).length,
      ativacao_7d_pct:
        ativaveis.length > 0 ? (ativadas.length / ativaveis.length) * 100 : 0,
      ativacao_base: ativaveis.length,
      cac: novasLojasMes > 0 ? (settings.ad_spend_daily * 30) / novasLojasMes : null,
      novas_lojas_mes: novasLojasMes,
      coortes,
      segmentos,
      settings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado.";
    return apiError("UNEXPECTED", `Erro ao calcular métricas SaaS: ${message}`, 500);
  }
}
