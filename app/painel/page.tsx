"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_PT, TODAY_ORDERS, type PanelOrder } from "./mock";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nowHHMM = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const PILL: Record<PanelOrder["status"], string> = {
  new: "bg-red-50 text-red-700 border-red-200",
  confirmed: "bg-amber-50 text-amber-800 border-amber-200",
  preparing: "bg-blue-50 text-blue-700 border-blue-200",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  out: "bg-emerald-50 text-emerald-700 border-emerald-200",
  delivered: "bg-stone-100 text-stone-500 border-stone-200",
  cancelled: "bg-stone-900 text-stone-300 border-stone-900",
};
// movimento das últimas 6h (demo visual — números reais vêm do backend)
const SPARKS: Record<string, number[]> = {
  count: [2, 3, 2, 5, 4, 6],
  revenue: [40, 90, 70, 150, 120, 186],
  ticket: [55, 62, 58, 66, 61, 63],
};

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Spark({ data, stroke }: { data: number[]; stroke: string }) {
  const max = Math.max(...data);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 96},${34 - (d / max) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 96 36" className="w-24 h-9 overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="96" cy={34 - (data[data.length - 1] / max) * 28} r="3" fill={stroke} />
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function PainelHoje() {
  // fase backend: force_closed + force_closed_at via Supabase (requireStore)
  const [closed, setClosed] = useState(false);
  const [closedAt, setClosedAt] = useState("");

  const stats = useMemo(() => {
    const valid = TODAY_ORDERS.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((s, o) => s + o.total_cents, 0);
    return {
      count: valid.length,
      revenue,
      ticket: valid.length ? Math.round(revenue / valid.length) : 0,
      awaiting: TODAY_ORDERS.filter((o) => o.status === "new").length,
    };
  }, []);

  const count = useCountUp(stats.count);
  const revenue = useCountUp(stats.revenue, 1100);
  const ticket = useCountUp(stats.ticket, 1000);
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const toggle = () => {
    if (!closed) setClosedAt(nowHHMM());
    setClosed((c) => !c);
  };

  const recent = [...TODAY_ORDERS].sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 5);

  const cards = [
    { label: "Pedidos hoje", display: String(count), sub: "válidos · exc. cancelados", spark: SPARKS.count, stroke: "#78716c" },
    { label: "Faturamento", display: brl(revenue), sub: "exc. cancelados", spark: SPARKS.revenue, stroke: "#16a34a" },
    { label: "Ticket médio", display: brl(ticket), sub: "por pedido válido", spark: SPARKS.ticket, stroke: "#2563eb" },
  ];

  return (
    <main className="relative p-4 sm:p-8 max-w-6xl mx-auto pb-16">
      {/* luz ambiente */}
      <div className="pointer-events-none absolute -top-24 right-0 w-[420px] h-[280px] rounded-full bg-gradient-to-br from-orange-200/50 to-rose-200/30 blur-3xl" aria-hidden />

      <div className="relative flex flex-wrap items-end gap-3 anim-rise">
        <div>
          <p className="text-xs font-bold text-stone-400 capitalize">{today}</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight">{greeting()}, João 👋</h1>
          <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${closed ? "bg-stone-400" : "bg-emerald-500 live-dot"}`} />
            {closed ? `loja fechada desde ${closedAt}` : "loja aberta · operação em tempo real"}
          </p>
        </div>
        <button onClick={toggle} aria-pressed={closed} aria-label={closed ? "Reabrir loja" : "Fechar loja agora"}
          className={`ml-auto flex items-center gap-2.5 rounded-2xl border bg-white pl-2 pr-4 py-2 text-sm font-extrabold shadow-sm transition-all active:scale-[0.98] ${closed ? "border-emerald-300 hover:border-emerald-400 text-emerald-700" : "border-stone-200 hover:border-red-300 hover:shadow text-stone-700"}`}>
          <span className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-300 ${closed ? "bg-emerald-500" : "bg-red-600"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${closed ? "left-0.5" : "left-[22px]"}`} />
          </span>
          {closed ? "Reabrir loja" : "Fechar agora"}
        </button>
      </div>

      {closed && (
        <div className="relative mt-3 bg-stone-900 text-white rounded-2xl px-4 py-3.5 flex items-center gap-3 anim-pop shadow-xl">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 text-lg shrink-0">🌙</span>
          <p className="text-sm"><b>Fechada desde {closedAt}.</b> <span className="text-stone-300">Vitrine mostra banner e bloqueia o checkout.</span></p>
        </div>
      )}

      {/* cards */}
      <div className="relative grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
        {cards.map((c, i) => (
          <div key={c.label} className="group bg-white/80 backdrop-blur border rounded-3xl shadow-sm p-4 sm:p-5 anim-rise hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-400">{c.label}</p>
              <Spark data={c.spark} stroke={c.stroke} />
            </div>
            <p className="font-display font-extrabold text-[26px] sm:text-[32px] tabular-nums mt-1 tracking-tight leading-none">{c.display}</p>
            <p className="text-[11px] text-stone-400 mt-1.5 pt-1.5 border-t border-dashed">{c.sub}</p>
          </div>
        ))}
        <Link href="/painel/pedidos"
          className={`border rounded-3xl p-4 sm:p-5 anim-rise group transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${stats.awaiting > 0 ? "bg-gradient-to-br from-red-700 via-red-600 to-red-500 border-transparent text-white shadow-[0_16px_36px_-12px_rgba(220,38,38,0.55)]" : "bg-white/80 border-stone-200"}`}
          style={{ animationDelay: "210ms" }}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${stats.awaiting > 0 ? "text-red-100" : "text-stone-400"}`}>Aguardando ação</p>
            <span className={`text-xs font-extrabold transition-transform group-hover:translate-x-0.5 ${stats.awaiting > 0 ? "text-white" : "text-stone-300"}`}>→</span>
          </div>
          <p className="font-display font-extrabold text-[26px] sm:text-[32px] tabular-nums mt-1 tracking-tight leading-none flex items-center gap-2.5">
            {stats.awaiting > 0 && <span className="w-2.5 h-2.5 rounded-full bg-white live-dot shrink-0" />}
            {stats.awaiting}
          </p>
          <p className={`text-[11px] mt-1.5 pt-1.5 border-t border-dashed ${stats.awaiting > 0 ? "text-red-100 border-white/25" : "text-stone-400"}`}>
            {stats.awaiting > 0 ? "toque p/ atender no kanban" : "tudo em dia ✓"}
          </p>
        </Link>
      </div>

      {/* últimos pedidos */}
      <section className="relative mt-4 bg-white/80 backdrop-blur border rounded-3xl shadow-sm overflow-hidden anim-rise" style={{ animationDelay: "280ms" }}>
        <div className="flex items-baseline px-4 sm:px-6 pt-5">
          <div>
            <h2 className="font-display font-extrabold text-lg tracking-tight">Últimos pedidos</h2>
            <p className="text-[11px] text-stone-400">o movimento agora mesmo</p>
          </div>
          <Link href="/painel/pedidos" className="ml-auto text-[13px] font-extrabold text-red-700 hover:underline underline-offset-4">
            Ver kanban →
          </Link>
        </div>
        <ul className="mt-2 pb-2">
          {recent.map((o) => {
            const late = o.status === "new" && o.minutesAgo > 10;
            return (
              <li key={o.id} className="px-2 sm:px-3">
                <Link href={`/painel/pedidos/${o.id}`}
                  className={`dish-card flex items-center gap-3 px-3 sm:px-3 py-3 rounded-2xl ${late ? "bg-red-50/60" : ""}`}>
                  <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-stone-700 to-stone-900 text-white text-sm font-extrabold">
                    {o.customer[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm">
                      <b className="truncate">{o.customer}</b>
                      <span className={`shrink-0 text-[10px] font-extrabold border rounded-full px-2 py-0.5 ${PILL[o.status]}`}>{STATUS_PT[o.status]}</span>
                    </span>
                    <span className="block text-xs text-stone-400 mt-0.5">
                      #{o.code} · há {o.minutesAgo} min {late && <b className="text-red-600">· precisa de você 🔴</b>} · {o.type === "delivery" ? "Entrega" : "Retirada"} · {o.payment}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-extrabold tabular-nums text-sm">{brl(o.total_cents)}</span>
                    <span className="block text-stone-300 text-xs transition-transform group-hover:translate-x-0.5">›</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="relative text-center text-[11px] text-stone-400 mt-5">🔔 som + toast + badge na aba quando cai pedido novo · fallback polling 30s</p>
    </main>
  );
}
