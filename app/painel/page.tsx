"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getHoje } from "@/lib/painel";
import { setForceClosed } from "@/lib/painel-actions";
import { PERIOD_LABEL, type CustomRange, type PeriodKind } from "@/lib/period";
import PeriodFilter from "@/components/ui/period-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/StatCard";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nowHHMM = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtClosedAt = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Manaus" });

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

type Hoje = Awaited<ReturnType<typeof getHoje>>;

export default function PainelHoje() {
  const [data, setData] = useState<Hoje | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<PeriodKind>("today");
  const [range, setRange] = useState<CustomRange>({});
  useEffect(() => { getHoje(period, range).then(setData).catch(() => setFailed(true)); }, [period, range]);
  const [closed, setClosed] = useState(false);
  const [closedAt, setClosedAt] = useState("");
  useEffect(() => {
    if (!data) return;
    setClosed(data.closed);
    setClosedAt(data.closedAt ? fmtClosedAt(data.closedAt) : "");
  }, [data]);

  const stats = data?.stats ?? { count: 0, revenue: 0, ticket: 0, awaiting: 0 };

  const count = useCountUp(stats.count);
  const revenue = useCountUp(stats.revenue, 1100);
  const ticket = useCountUp(stats.ticket, 1000);
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const toggle = async () => {
    const next = !closed;
    setClosed(next); // otimista; o banner/areaberta refletem o banco em seguida
    if (next) setClosedAt(nowHHMM());
    const r = await setForceClosed(next);
    if (r.ok && r.at) setClosedAt(fmtClosedAt(r.at));
    else if (!r.ok) setClosed(!next);
  };

  const recent = data?.recent ?? [];

  const cards = [
    { label: `Pedidos · ${PERIOD_LABEL[period]}`, display: String(count), sub: "válidos · exc. cancelados", tone: "flat" as const, spark: SPARKS.count, stroke: "var(--muted)" },
    { label: `Faturamento · ${PERIOD_LABEL[period]}`, display: brl(revenue), sub: "exc. cancelados", tone: "up" as const, spark: SPARKS.revenue, stroke: "var(--green)" },
    { label: `Ticket médio · ${PERIOD_LABEL[period]}`, display: brl(ticket), sub: "por pedido válido", tone: "flat" as const, spark: SPARKS.ticket, stroke: "var(--info)" },
  ];

  if (failed) {
    return (
      <main className="admin-content">
        <p className="text-sm font-bold text-[var(--red)]">Não foi possível carregar o dia.</p>
        <button onClick={() => window.location.reload()} className="btn btn--ghost mt-2">
          Tentar de novo
        </button>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="admin-content">
        <p className="text-sm text-[var(--muted)] animate-pulse">Carregando o dia…</p>
      </main>
    );
  }

  return (
    <main className="admin-content">
      <div className="flex flex-wrap items-end gap-3 anim-rise">
        <div>
          <p className="text-xs font-bold text-[var(--muted)] capitalize">{today}</p>
          <h1 className="font-extrabold text-[21px] tracking-[-0.02em] leading-tight">{greeting()}, {data.storeName.split(" ")[0]} 👋</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${closed ? "bg-[var(--muted)]" : "bg-[var(--green)] live-dot"}`} />
            {closed ? `loja fechada desde ${closedAt}` : "loja aberta · operação em tempo real"}
          </p>
        </div>
        <button onClick={toggle} aria-pressed={closed} aria-label={closed ? "Reabrir loja" : "Fechar loja agora"}
          className="btn btn--ghost ml-auto">
          <span className={`store-dot ${closed ? "" : "store-dot--open"}`} aria-hidden />
          {closed ? "Reabrir loja" : "Fechar agora"}
        </button>
      </div>

      {/* controles de período (compartilhado: datepicker no "Personalizado") */}
      <div className="mt-4">
        <PeriodFilter period={period} range={range} onPeriod={setPeriod} onRange={setRange} />
      </div>

      {closed && (
        <div className="alert-banner anim-pop mt-3" role="status">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--red-soft)] text-lg shrink-0">🌙</span>
          <p className="text-sm"><b>Fechada desde {closedAt}.</b> Vitrine mostra banner e bloqueia o checkout.</p>
        </div>
      )}

      {/* cards */}
      <div className="kpi-grid mt-5">
        {cards.map((c, i) => (
          <div key={c.label} style={{ animationDelay: `${i * 70}ms` }} className="anim-rise">
            <StatCard label={c.label} value={c.display} sub={c.sub} deltaTone={c.tone} icon={<Spark data={c.spark} stroke={c.stroke} />} />
          </div>
        ))}
        <Link href="/painel/pedidos"
          className="card anim-rise group transition-shadow duration-300"
          style={{ animationDelay: "210ms" }}>
          <div className="stat-top">
            <span className="stat-label">Aguardando ação</span>
            <span className="text-xs font-extrabold text-[var(--muted)] transition-transform group-hover:translate-x-0.5">→</span>
          </div>
          <span className="stat-value flex items-center gap-2.5">
            {stats.awaiting > 0 && <span className="live-dot w-2.5 h-2.5 rounded-full bg-[var(--red)] shrink-0" />}
            {stats.awaiting}
          </span>
          <span className="stat-delta stat-delta--flat">
            {stats.awaiting > 0 ? "toque p/ atender no kanban" : "tudo em dia ✓"}
          </span>
        </Link>
      </div>

      {/* últimos pedidos */}
      <section className="card mt-4 anim-rise" style={{ animationDelay: "280ms" }}>
        <div className="card-head">
          <div>
            <h2 className="card-title">Últimos pedidos</h2>
            <p className="text-[11px] text-[var(--muted)]">o movimento agora mesmo</p>
          </div>
          <Link href="/painel/pedidos" className="ml-auto text-[13px] font-extrabold text-[var(--red)] hover:underline underline-offset-4">
            Ver kanban →
          </Link>
        </div>
        <ul className="mt-2 pb-2">
          {recent.map((o) => {
            const late = o.status === "new" && o.minutesAgo > 10;
            return (
              <li key={o.id} className="px-2 sm:px-3">
                <Link href={`/painel/pedidos/${o.id}`}
                  className="dish-card flex items-center gap-3 px-3 sm:px-3 py-3 rounded-2xl">
                  <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-[var(--pill-active-bg)] text-[var(--pill-active-ink)] text-sm font-extrabold">
                    {o.customer[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm">
                      <b className="truncate">{o.customer}</b>
                      <StatusBadge status={o.status} size="sm" />
                    </span>
                    <span className="block text-xs text-[var(--muted)] mt-0.5">
                      #{o.code} · há {o.minutesAgo} min {late && <b className="text-[var(--red)]">· precisa de você 🔴</b>} · {o.type === "delivery" ? "Entrega" : "Retirada"} · {o.payment}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-extrabold tabular-nums text-sm">{brl(o.total_cents)}</span>
                    <span className="block text-[var(--muted)] text-xs">›</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="relative text-center text-[11px] text-[var(--muted)] mt-5">🔔 som + toast + badge na aba quando cai pedido novo · fallback polling 30s</p>
    </main>
  );
}
