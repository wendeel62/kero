"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getHoje } from "@/lib/painel";
import { setForceClosed } from "@/lib/painel-actions";
import { TYPE_PT } from "@/lib/painel-utils";
import { PERIOD_LABEL, type CustomRange, type PeriodKind } from "@/lib/period";
import PeriodFilter from "@/components/ui/period-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/StatCard";

const DeliveryMap = dynamic(() => import("@/components/delivery-map"), { ssr: false });

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nowHHMM = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtClosedAt = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Manaus" });

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
  const [abaMeta, setAbaMeta] = useState<"daily" | "monthly">("daily");
  useEffect(() => { getHoje(period, range).then(setData).catch(() => setFailed(true)); }, [period, range]);
  const [closed, setClosed] = useState(false);
  const [closedAt, setClosedAt] = useState("");
  useEffect(() => {
    if (!data) return;
    setClosed(data.closed);
    setClosedAt(data.closedAt ? fmtClosedAt(data.closedAt) : "");
  }, [data]);

  const stats = data?.stats ?? { count: 0, revenue: 0, ticket: 0, awaiting: 0, entregasAndamento: 0 };

  const count = useCountUp(stats.count);
  const revenue = useCountUp(stats.revenue, 1100);
  const ticket = useCountUp(stats.ticket, 1000);
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toUpperCase());

  const toggle = async () => {
    const next = !closed;
    setClosed(next); // otimista; o banner/areaberta refletem o banco em seguida
    if (next) setClosedAt(nowHHMM());
    const r = await setForceClosed(next);
    if (r.ok && r.at) setClosedAt(fmtClosedAt(r.at));
    else if (!r.ok) setClosed(!next);
  };

  const recent = data?.recent ?? [];
  const resumo = data?.resumo ?? { total: 0, cancelados: 0, perdidaCents: 0, taxaCancelamento: 0, aguardando10min: 0, split: { delivery: 0, pickup: 0, dine_in: 0 } };
  const meta = abaMeta === "daily" ? data?.metas.daily : data?.metas.monthly;
  const pctMeta = meta?.percent ?? 0;
  const circ = 2 * Math.PI * 70;
  const validosSplit = resumo.split.delivery + resumo.split.pickup + resumo.split.dine_in || 1;
  const semValidos = resumo.split.delivery + resumo.split.pickup + resumo.split.dine_in === 0;
  const taxaPct = (resumo.taxaCancelamento * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const taxaRuim = resumo.taxaCancelamento > 0.1;
  const atrasados = resumo.aguardando10min;

  const cards = [
    { label: `Pedidos · ${PERIOD_LABEL[period]}`, display: String(count), sub: "válidos · exc. cancelados", tone: "flat" as const },
    { label: `Faturamento · ${PERIOD_LABEL[period]}`, display: brl(revenue), sub: "exc. cancelados", tone: "up" as const },
    { label: `Ticket médio · ${PERIOD_LABEL[period]}`, display: brl(ticket), sub: "por pedido válido", tone: "flat" as const },
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
          <p className="text-xs font-bold text-[var(--muted)]">{today}</p>
          <h1 className="font-extrabold text-[21px] tracking-[-0.02em] leading-tight">{greeting()}, {data.storeName} 👋</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${closed ? "bg-[var(--muted)]" : "bg-[var(--green)] live-dot"}`} />
            {closed ? `loja fechada desde ${closedAt}` : "loja aberta · operação em tempo real"}
          </p>
        </div>
        <button onClick={toggle} aria-pressed={closed} aria-label={closed ? "Reabrir loja" : "Fechar loja agora"}
          className="btn btn--ghost ml-auto">
          <span className={`w-2 h-2 rounded-full ${closed ? "bg-[var(--red)]" : "bg-[var(--green)]"}`} aria-hidden />
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
            <StatCard label={c.label} value={c.display} sub={c.sub} deltaTone={c.tone} />
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
            {stats.awaiting > 0 && <span className={`live-dot w-2.5 h-2.5 rounded-full shrink-0 ${atrasados > 0 ? "bg-[var(--red)]" : "bg-[var(--amber)]"}`} />}
            {stats.awaiting}
          </span>
          <span className={`stat-delta ${atrasados > 0 ? "stat-delta--warn" : "stat-delta--flat"}`}>
            {stats.awaiting === 0 ? "tudo em dia ✓"
              : atrasados > 0 ? `${atrasados} há +10 min 🔴 — toque p/ atender`
              : "toque p/ atender no kanban"}
          </span>
        </Link>
        <Link href="/painel/pedidos"
          className="card anim-rise group transition-shadow duration-300"
          style={{ animationDelay: "280ms" }}>
          <div className="stat-top">
            <span className="stat-label">Entregas em andamento</span>
            <span className="text-xs font-extrabold text-[var(--muted)] transition-transform group-hover:translate-x-0.5">→</span>
          </div>
          <span className="stat-value flex items-center gap-2.5">
            {stats.entregasAndamento > 0 && <span className="live-dot w-2.5 h-2.5 rounded-full bg-[var(--info)] shrink-0" />}
            {stats.entregasAndamento}
          </span>
          <span className="stat-delta stat-delta--flat">
            {stats.entregasAndamento > 0 ? "preparando · pronto · a caminho" : "nenhuma no momento"}
          </span>
        </Link>
      </div>

      {/* novos KPIs: meta, cancelamento, espera >10min, split por tipo */}
      <div className="kpi-grid kpi-grid--3 mt-4">
        <div className="anim-rise" style={{ animationDelay: "350ms" }}>
          <StatCard label="Taxa de cancelamento" value={`${taxaPct}%`}
            sub={resumo.total ? `${resumo.cancelados} de ${resumo.total} pedidos` : "sem pedidos no período"}
            deltaTone={taxaRuim ? "warn" : "flat"} />
        </div>
        <div className="anim-rise" style={{ animationDelay: "420ms" }}>
          <StatCard label="Receita perdida" value={brl(resumo.perdidaCents)}
            sub={resumo.cancelados ? `${resumo.cancelados} ${resumo.cancelados === 1 ? "cancelado" : "cancelados"} no período` : "nenhum cancelamento ✓"}
            deltaTone={resumo.perdidaCents > 0 ? "warn" : "flat"} />
        </div>
        <div className="anim-rise" style={{ animationDelay: "490ms" }}>
          <div className="card stat-card kpi-card">
            <div className="stat-top"><span className="stat-label">Delivery · Retirada · Mesa</span></div>
            <div className="stat-value flex gap-4">
              {([["delivery", "var(--amber)"], ["pickup", "var(--info)"], ["dine_in", "var(--green)"]] as const).map(([t, cor]) => (
                <div key={t} className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-[1rem] leading-tight font-extrabold tabular-nums">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} aria-hidden />
                    {resumo.split[t]}
                  </span>
                  <span className="block text-[11px] font-bold text-[var(--muted)] truncate">{TYPE_PT[t]}</span>
                  <span className="block text-[11px] tabular-nums" style={{ color: cor }}>
                    {Math.round((resumo.split[t] / validosSplit) * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <span className="stat-delta stat-delta--flat">
              {semValidos ? "sem pedidos válidos no período" : "pedidos válidos no período"}
            </span>
          </div>
        </div>
      </div>

      {/* meta de faturamento (donut) + entregadores em rota (mapa) */}
      <div className="dash-cols dash-cols--equal mt-4">
        <section className="card anim-rise" style={{ animationDelay: "560ms" }}>
          <div className="card-head">
            <h2 className="card-title">Meta de faturamento</h2>
            <div className="donut-tabs" role="tablist" aria-label="Período da meta">
              {(["daily", "monthly"] as const).map((aba) => (
                <button key={aba} type="button" role="tab" aria-selected={abaMeta === aba}
                  className={`donut-tab ${abaMeta === aba ? "is-active" : ""}`}
                  onClick={() => setAbaMeta(aba)}>
                  {aba === "daily" ? "Dia" : "Mês"}
                </button>
              ))}
            </div>
          </div>
          {meta != null ? (
            <>
              <div className="meta-progress mt-3">
                <div className="meta-progress-head">
                  <span className="meta-legenda">{brl(meta.revenueCents)} de {brl(meta.targetCents)}</span>
                  <span className="meta-pct">{pctMeta}%</span>
                </div>
                <div className="meta-track" role="progressbar" aria-label={`Progresso da meta ${abaMeta === "daily" ? "do dia" : "do mês"}`}
                  aria-valuenow={pctMeta} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`meta-fill ${pctMeta >= 100 ? "is-complete" : ""}`} style={{ width: `${Math.min(100, pctMeta)}%` }} />
                </div>
              </div>
              <div className="meta-donut-area mt-3">
                <div className="donut-container">
                  <svg width="160" height="160" viewBox="0 0 160 160" className="donut-svg" role="img" aria-label={`Progresso da meta: ${pctMeta}%`}>
                    <circle cx={80} cy={80} r={70} fill="none" stroke="var(--pill-bg)" strokeWidth={18} />
                    <circle cx={80} cy={80} r={70} fill="none" stroke="var(--accent)" strokeWidth={18}
                      strokeDasharray={circ} strokeDashoffset={circ - (Math.min(100, pctMeta) / 100) * circ}
                      strokeLinecap="round" transform="rotate(-90 80 80)" className="donut-fill" />
                    <text x={80} y={74} textAnchor="middle" fill="var(--text)" fontSize="20" fontWeight="800">{pctMeta}%</text>
                    <text x={80} y={92} textAnchor="middle" fill="var(--muted)" fontSize="11">da meta</text>
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--muted)] mt-3">Sem meta cadastrada p/ {abaMeta === "daily" ? "o dia" : "o mês"} — cadastre no Financeiro.</p>
          )}
        </section>
        <section className="card anim-rise" style={{ animationDelay: "630ms" }}>
          <div className="card-head">
            <h2 className="card-title">Entregadores em rota</h2>
            <span className="text-[11px] font-extrabold tabular-nums text-[var(--muted)] bg-[var(--surface-2)] rounded-full px-2 py-0.5">
              {data.entregadores.emRota.length} {data.entregadores.emRota.length === 1 ? "ativo" : "ativos"}
            </span>
          </div>
          <div className="mini-map-wrapper mt-3">
            <DeliveryMap points={[]} couriers={data.entregadores.emRota} loja={data.loja} />
          </div>
          {data.entregadores.emRota.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Nenhum entregador em rota agora.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {data.entregadores.emRota.map((c) => (
                <li key={c.courierId} className="flex items-center gap-2 text-[13px]">
                  <b>{c.nome}</b>
                  <span className="text-[var(--muted)] text-xs">{c.paradas} {c.paradas === 1 ? "parada restante" : "paradas restantes"}</span>
                  <span className="ml-auto text-[11px] font-extrabold text-[var(--green)] bg-[var(--green-soft)] rounded-full px-2.5 py-0.5">em rota</span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
                      #{o.code} · há {o.minutesAgo} min {late && <b className="text-[var(--red)]">· precisa de você 🔴</b>} · {TYPE_PT[o.type]} · {o.payment}
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
    </main>
  );
}
