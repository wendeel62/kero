"use client";

import { useCallback, useEffect, useState } from "react";
import { getRelatorios } from "@/lib/painel";
import { saveMeta } from "@/lib/painel-actions";
import { GOAL_LABEL, GOAL_PERIODS } from "@/lib/goals";
import { PERIOD_LABEL, parsePeriodKind, type CustomRange } from "@/lib/period";
import PeriodFilter from "@/components/ui/period-filter";
import { parseBRLToCents } from "@/lib/pricing";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Relatorio = Awaited<ReturnType<typeof getRelatorios>>;
type MetaPeriod = (typeof GOAL_PERIODS)[number];

export default function Relatorios() {
  const [period, setPeriod] = useState<string>("7d");
  const [range, setRange] = useState<CustomRange>({});
  const [data, setData] = useState<Relatorio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<MetaPeriod | null>(null);

  const load = useCallback(async (p: string, r: CustomRange = {}) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getRelatorios(p, r));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(period, range); }, [period, range, load]);

  const kind = parsePeriodKind(period);
  const periodoLabel = PERIOD_LABEL[kind];

  async function definirMeta(gp: MetaPeriod, fd: FormData) {
    // o campo é em reais ("150,00"); parseBRLToCents devolve centavos
    const cents = parseBRLToCents(String(fd.get("target") ?? ""));
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Informe um valor em reais (ex.: 150,00).");
      return;
    }
    setSaving(gp);
    setError(null);
    try {
      const r = await saveMeta(gp, cents);
      if (!r.ok) throw new Error(r.error ?? "Erro ao salvar meta.");
      await load(period, range);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="admin-content">
      <div className="anim-rise">
        <h1 className="font-extrabold text-[21px] tracking-[-0.02em] leading-tight">Relatórios</h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">faturamento, mais vendidos e metas</p>
      </div>

      {/* filtro de período (compartilhado: datepicker no "Personalizado") */}
      <div className="mt-4">
        <PeriodFilter size="sm" period={kind} range={range} onPeriod={(k) => setPeriod(k)} onRange={setRange} />
      </div>

      {error && (
        <div className="card mt-4 p-4 text-sm text-[var(--red)]">{error}</div>
      )}

      {loading && !data && (
        <div className="card mt-4 p-8 text-center text-sm text-[var(--muted)]">carregando…</div>
      )}

      {data && (
        <>
          {/* 3 cartões — rótulo acompanha o período */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="card anim-rise p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                Faturamento · {periodoLabel}
              </p>
              <p className="font-extrabold text-2xl tabular-nums mt-1">{brl(data.revenueCents)}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                {new Date(data.from).toLocaleDateString("pt-BR")} — {new Date(data.to).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="card anim-rise p-4" style={{ animationDelay: "60ms" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                Pedidos · {periodoLabel}
              </p>
              <p className="font-extrabold text-2xl tabular-nums mt-1">{data.count}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">pedidos válidos no período</p>
            </div>
            <div className="card anim-rise p-4" style={{ animationDelay: "120ms" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                Ticket médio · {periodoLabel}
              </p>
              <p className="font-extrabold text-2xl tabular-nums mt-1">{brl(data.ticketCents)}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">faturamento ÷ pedidos</p>
            </div>
          </div>

          {/* bloco de metas */}
          <section className="card mt-4 anim-rise" style={{ animationDelay: "180ms" }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">Metas de faturamento</h2>
                <p className="text-[11px] text-[var(--muted)]">defina o alvo — a janela é calculada automaticamente</p>
              </div>
            </div>
            <ul className="mt-1 pb-2">
              {GOAL_PERIODS.map((gp) => {
                const meta = data.metas.find((m) => m.period === gp);
                return (
                  <li key={gp} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="text-sm font-bold min-w-[120px]">{GOAL_LABEL[gp]}</span>
                    {meta ? (
                      <span className="flex-1 flex items-center gap-3">
                        <span className="flex-1 h-2 rounded-full bg-[var(--pill-bg)] overflow-hidden">
                          <span
                            className="block h-full bg-[var(--red)] rounded-full transition-all"
                            style={{ width: `${meta.percent}%` }}
                          />
                        </span>
                        <span className="text-xs font-extrabold tabular-nums min-w-[40px] text-right">{meta.percent}%</span>
                        <span className="text-xs text-[var(--muted)] tabular-nums">
                          {brl(meta.revenueCents)} / {brl(meta.targetCents)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">sem meta cadastrada</span>
                    )}
                    <form
                      className="flex items-center gap-2"
                      action={(fd) => definirMeta(gp, fd)}
                    >
                      <input
                        type="text"
                        name="target"
                        inputMode="decimal"
                        defaultValue={meta ? (meta.targetCents / 100).toFixed(2).replace(".", ",") : ""}
                        placeholder="R$ 0,00"
                        className="w-24 px-2 py-1 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] tabular-nums"
                      />
                      <button
                        type="submit"
                        disabled={saving === gp}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[var(--red)] text-white disabled:opacity-50"
                      >
                        {meta ? "Alterar" : "Definir"}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* mais vendidos */}
          <section className="card mt-4 anim-rise" style={{ animationDelay: "240ms" }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">Mais vendidos</h2>
                <p className="text-[11px] text-[var(--muted)]">top 10 por faturamento no período</p>
              </div>
            </div>
            <ul className="mt-1 pb-2">
              {data.topProducts.map((p, i) => (
                <li key={p.name} className="px-3 py-2.5 flex items-center gap-3">
                  <span className="shrink-0 w-6 text-center text-xs font-extrabold text-[var(--muted)]">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-bold">{p.name}</span>
                  <span className="text-xs text-[var(--muted)] tabular-nums">{p.qty}×</span>
                  <span className="text-sm font-extrabold tabular-nums">{brl(p.cents)}</span>
                </li>
              ))}
              {data.topProducts.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-[var(--muted)]">nenhum item vendido no período</li>
              )}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}