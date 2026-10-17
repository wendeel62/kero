"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLojas, type AdminStoreRow } from "@/lib/admin";

type SaasMetrics = {
  mrr: number;
  mrr_by_plan: {
    basico: { count: number; value: number };
    completo: { count: number; value: number };
  };
  adesao_revenue_month: number;
  lojas_ativas: number;
  lojas_total: number;
  churn_30d: number;
  ativacao_7d_pct: number;
  ativacao_base: number;
  cac: number | null;
  novas_lojas_mes: number;
  coortes: Array<{ mes: string; novas: number; retidas: number }>;
  segmentos: Array<{ segment: string; lojas: number; pedidos_30d: number }>;
  settings: {
    plan_basico: number;
    plan_completo: number;
    adesao_fee: number;
    ad_spend_daily: number;
  };
};

type DashboardData = {
  metrics: SaasMetrics;
  recent: AdminStoreRow[];
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (n: number) => n.toLocaleString("pt-BR");

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [metrics, recent] = await Promise.all([
        fetch("/api/admin/saas-metrics").then(async (r) => {
          if (!r.ok) throw new Error("Falha ao carregar métricas.");
          return (await r.json()) as SaasMetrics;
        }),
        getLojas({ page: 1, status: "all", q: "" }).then((d) => d.stores.slice(0, 5)),
      ]);
      setData({ metrics, recent });
    } catch {
      setError("Não foi possível carregar o dashboard. Tente novamente.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const retry = () => load();

  if (error) {
    return (
      <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-16">
        <div className="bg-red-50 border border-red-200 rounded-3xl shadow-sm p-4 sm:p-6">
          <p className="font-bold text-red-700">{error}</p>
          <button onClick={retry} className="mt-3 text-xs font-extrabold text-red-600 hover:underline">
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-16">
        <p className="text-sm text-stone-400 animate-pulse">Carregando métricas…</p>
      </main>
    );
  }

  const { metrics, recent } = data;
  const churnPct =
    metrics.lojas_total > 0 ? (metrics.churn_30d / metrics.lojas_total) * 100 : 0;

  const kpis = [
    { label: "MRR", value: brl(metrics.mrr), sub: `${int(metrics.mrr_by_plan.basico.count)} básico · ${int(metrics.mrr_by_plan.completo.count)} completo` },
    { label: "Adesão no mês", value: brl(metrics.adesao_revenue_month), sub: "taxa paga no mês" },
    {
      label: "Lojas",
      value: `${int(metrics.lojas_ativas)} / ${int(metrics.lojas_total)}`,
      sub: "ativas / total",
    },
    {
      label: "Churn de lojas",
      value: metrics.lojas_total > 0 ? `${churnPct.toFixed(1)}%` : "—",
      sub: `${int(metrics.churn_30d)} pararam (30d)`,
    },
    {
      label: "Ativação 7d",
      value: metrics.ativacao_base > 0 ? `${metrics.ativacao_7d_pct.toFixed(1)}%` : "—",
      sub: `base ${int(metrics.ativacao_base)} lojas`,
    },
    {
      label: "CAC",
      value: metrics.cac === null ? "—" : brl(metrics.cac),
      sub: `${int(metrics.novas_lojas_mes)} novas no mês`,
    },
  ];

  return (
    <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3 anim-rise">
        <div>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight">
            Painel executivo
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            SaaS do dono · fuso America/Manaus
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/lojas" className="border border-stone-200 bg-white font-extrabold rounded-xl px-4 py-2.5 text-sm hover:border-stone-400 transition-colors">
            Ver todas as lojas
          </Link>
          <Link href="/admin/lojas?open=1" className="bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl px-5 py-2.5 text-sm transition-colors active:scale-[0.98]">
            + Nova loja
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 anim-rise" style={{ animationDelay: "60ms" }}>
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border rounded-3xl shadow-sm p-4 sm:p-5 flex flex-col">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-400">
              {k.label}
            </p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display font-extrabold text-2xl sm:text-3xl tabular-nums tracking-tight">
                {k.value}
              </span>
              <span className="text-xs text-stone-500 self-baseline">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-stone-400 anim-rise">
        Calculado com: básico {brl(metrics.settings.plan_basico)} · completo{" "}
        {brl(metrics.settings.plan_completo)} · adesão {brl(metrics.settings.adesao_fee)} ·
        gasto/dia {brl(metrics.settings.ad_spend_daily)}
      </p>

      <section className="mt-6 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "120ms" }}>
        <h2 className="font-display font-extrabold mb-4">Coortes (6 meses)</h2>
        {metrics.coortes.length === 0 ? (
          <p className="text-sm text-stone-400 bg-stone-50 border border-dashed rounded-2xl p-4 text-center">
            Sem dados de coortes ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-stone-400">
                  <th className="pb-2 pr-4">Mês</th>
                  <th className="pb-2 pr-4 text-right">Novas</th>
                  <th className="pb-2 text-right">Retidas (pedido 30d)</th>
                </tr>
              </thead>
              <tbody>
                {metrics.coortes.map((c) => (
                  <tr key={c.mes} className="border-t border-stone-100">
                    <td className="py-2 pr-4 font-mono font-bold text-stone-700">{c.mes}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{int(c.novas)}</td>
                    <td className="py-2 text-right tabular-nums">{int(c.retidas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "160ms" }}>
        <h2 className="font-display font-extrabold mb-4">Segmentos</h2>
        {metrics.segmentos.length === 0 ? (
          <p className="text-sm text-stone-400 bg-stone-50 border border-dashed rounded-2xl p-4 text-center">
            Sem segmentos ainda.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {metrics.segmentos.map((s) => (
              <li key={s.segment} className="flex items-center justify-between gap-3 border-b border-stone-100 last:border-0 pb-2.5 last:pb-0">
                <span className="font-bold text-stone-700 truncate">{s.segment}</span>
                <span className="shrink-0 text-xs text-stone-500 font-mono">
                  {int(s.lojas)} lojas · {int(s.pedidos_30d)} pedidos (30d)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-extrabold">Últimas lojas cadastradas</h2>
          <Link href="/admin/lojas" className="text-[11px] font-extrabold text-stone-500 hover:text-red-600 transition-colors">
            Ver todas →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-400 bg-stone-50 border border-dashed rounded-2xl p-4 text-center">
            Nenhuma loja cadastrada ainda.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {recent.map((s) => (
              <li key={s.id} className="dish-card bg-white border rounded-3xl shadow-sm p-3 flex items-center gap-3">
                <Link href={`/admin/lojas/${s.id}`} className="shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl bg-stone-900 text-white font-display font-extrabold text-sm">
                  {s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/lojas/${s.id}`} className="block font-bold text-stone-700 truncate hover:underline">
                    {s.name}
                  </Link>
                  <span className="block text-[11px] text-stone-400 font-mono truncate">
                    kero.app/{s.slug} · {s.ownerEmail}
                  </span>
                </div>
                <span className="shrink-0 text-stone-300 font-bold">›</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
