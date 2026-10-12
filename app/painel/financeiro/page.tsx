"use client";

import { useCallback, useEffect, useState } from "react";
import { getFinanceiro } from "@/lib/painel";
import {
  abrirCaixa, movimentoCaixa, fecharCaixa, pagarConta, saveConta, deleteConta,
} from "@/lib/painel-actions";
import { PERIOD_LABEL, parsePeriodKind, type CustomRange } from "@/lib/period";
import PeriodFilter from "@/components/ui/period-filter";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Financeiro = Awaited<ReturnType<typeof getFinanceiro>>;

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-[var(--pill-bg)] text-[var(--pill-ink)]",
  atrasada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  paga: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

export default function Financeiro() {
  const [period, setPeriod] = useState<string>("7d");
  const [range, setRange] = useState<CustomRange>({});
  const [data, setData] = useState<Financeiro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // caixa form
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [movDir, setMovDir] = useState<"in" | "out">("in");
  const [movAmount, setMovAmount] = useState("");
  const [movNote, setMovNote] = useState("");

  // conta form
  const [contaDesc, setContaDesc] = useState("");
  const [contaAmount, setContaAmount] = useState("");
  const [contaDue, setContaDue] = useState("");

  // pagar form
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const load = useCallback(async (p: string, r: CustomRange = {}) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getFinanceiro(p, r));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(period, range); }, [period, range, load]);

  const kind = parsePeriodKind(period);
  const periodoLabel = PERIOD_LABEL[kind];
  const cash = data?.cash ?? null;
  const summary = cash?.summary ?? null;

  async function doAbrir(fd: FormData) {
    const cents = Math.round(Number(String(fd.get("opening") ?? "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) { setError("Informe um fundo inicial válido."); return; }
    const r = await abrirCaixa(cents);
    if (!r.ok) setError(r.error ?? "Erro ao abrir caixa.");
    else { setOpening(""); await load(period, range); }
  }

  async function doMovimento(fd: FormData) {
    const cents = Math.round(Number(String(fd.get("amount") ?? "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { setError("Informe um valor válido."); return; }
    const r = await movimentoCaixa(movDir, cents, movNote);
    if (!r.ok) setError(r.error ?? "Erro ao lançar movimento.");
    else { setMovAmount(""); setMovNote(""); await load(period, range); }
  }

  async function doFechar(fd: FormData) {
    const cents = Math.round(Number(String(fd.get("closing") ?? "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) { setError("Informe um valor contado válido."); return; }
    const r = await fecharCaixa(cents);
    if (!r.ok) setError(r.error ?? "Erro ao fechar caixa.");
    else { setClosing(""); await load(period, range); }
  }

  async function doSaveConta(fd: FormData) {
    const cents = Math.round(Number(String(fd.get("amount") ?? "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { setError("Informe um valor válido."); return; }
    const due = String(fd.get("due") ?? "");
    const r = await saveConta({ description: contaDesc, amountCents: cents, dueDate: due });
    if (!r.ok) setError(r.error ?? "Erro ao salvar conta.");
    else { setContaDesc(""); setContaAmount(""); setContaDue(""); await load(period, range); }
  }

  async function doDeleteConta(id: string) {
    if (!confirm("Excluir esta conta?")) return;
    const r = await deleteConta(id);
    if (!r.ok) setError(r.error ?? "Erro ao excluir conta.");
    else await load(period, range);
  }

  async function doPagar(fd: FormData) {
    if (!payId) return;
    const cents = Math.round(Number(String(fd.get("paid") ?? "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { setError("Informe um valor pago válido."); return; }
    const r = await pagarConta(payId, cents);
    if (!r.ok) setError(r.error ?? "Erro ao pagar conta.");
    else { setPayId(null); setPayAmount(""); await load(period, range); }
  }

  const isPaying = (id: string) => payId === id;

  return (
    <main className="admin-content">
      <div className="anim-rise">
        <h1 className="font-extrabold text-[21px] tracking-[-0.02em] leading-tight">Financeiro</h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">caixa, contas a pagar e resultado</p>
      </div>

      <div className="mt-4">
        <PeriodFilter size="sm" period={kind} range={range} onPeriod={(k) => setPeriod(k)} onRange={setRange} />
      </div>

      {error && <div className="card mt-4 p-4 text-sm text-[var(--red)]">{error}</div>}

      {loading && !data && (
        <div className="card mt-4 p-8 text-center text-sm text-[var(--muted)]">carregando…</div>
      )}

      {data && (
        <>
          {/* (a) Resumo do período */}
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
                Despesas pagas · {periodoLabel}
              </p>
              <p className="font-extrabold text-2xl tabular-nums mt-1">{brl(data.paidExpensesCents)}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">contas a pagar quitadas no período</p>
            </div>
            <div className="card anim-rise p-4" style={{ animationDelay: "120ms" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                Líquido · {periodoLabel}
              </p>
              <p className="font-extrabold text-2xl tabular-nums mt-1">{brl(data.netRevenueCents)}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">faturamento − despesas pagas</p>
            </div>
          </div>

          {/* (b) Caixa */}
          <section className="card mt-4 anim-rise" style={{ animationDelay: "180ms" }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">Caixa</h2>
                <p className="text-[11px] text-[var(--muted)]">
                  {cash ? "caixa aberto — lance movimentações ou feche com o valor contado" : "abra o caixa para começar o dia"}
                </p>
              </div>
            </div>

            {!cash && (
              <form className="px-3 pb-3 flex flex-col sm:flex-row sm:items-end gap-2" action={doAbrir}>
                <div className="flex-1">
                  <label className="text-xs font-bold text-[var(--muted)]">Fundo inicial (R$)</label>
                  <input
                    type="text"
                    name="opening"
                    inputMode="decimal"
                    value={opening}
                    onChange={(e) => setOpening(e.target.value)}
                    placeholder="0,00"
                    className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-[var(--red)] text-white"
                >
                  Abrir caixa
                </button>
              </form>
            )}

            {cash && summary && (
              <div className="px-3 pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <div className="text-xs">
                    <span className="text-[var(--muted)]">Abertura</span>
                    <p className="font-extrabold tabular-nums">{brl(cash.session.opening_cents)}</p>
                  </div>
                  <div className="text-xs">
                    <span className="text-[var(--muted)]">Entradas</span>
                    <p className="font-extrabold tabular-nums text-green-600">{brl(summary.entradas)}</p>
                  </div>
                  <div className="text-xs">
                    <span className="text-[var(--muted)]">Saídas</span>
                    <p className="font-extrabold tabular-nums text-red-600">{brl(summary.saidas)}</p>
                  </div>
                  <div className="text-xs">
                    <span className="text-[var(--muted)]">Saldo</span>
                    <p className="font-extrabold tabular-nums">{brl(summary.saldo)}</p>
                  </div>
                </div>

                {/* lançar movimento */}
                <form className="flex flex-col sm:flex-row sm:items-end gap-2 mb-3" action={doMovimento}>
                  <div>
                    <label className="text-xs font-bold text-[var(--muted)]">Tipo</label>
                    <select
                      value={movDir}
                      onChange={(e) => setMovDir(e.target.value as "in" | "out")}
                      className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                    >
                      <option value="in">Entrada</option>
                      <option value="out">Saída</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-[var(--muted)]">Valor (R$)</label>
                    <input
                      type="text"
                      name="amount"
                      inputMode="decimal"
                      value={movAmount}
                      onChange={(e) => setMovAmount(e.target.value)}
                      placeholder="0,00"
                      className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] tabular-nums"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-xs font-bold text-[var(--muted)]">Nota</label>
                    <input
                      type="text"
                      value={movNote}
                      onChange={(e) => setMovNote(e.target.value)}
                      placeholder="ex.: troco, fornecedor…"
                      className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="text-xs font-bold px-4 py-2 rounded-lg bg-[var(--red)] text-white"
                  >
                    Lançar
                  </button>
                </form>

                {/* fechar caixa */}
                <form className="flex flex-col sm:flex-row sm:items-end gap-2" action={doFechar}>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-[var(--muted)]">Valor contado (R$)</label>
                    <input
                      type="text"
                      name="closing"
                      inputMode="decimal"
                      value={closing}
                      onChange={(e) => setClosing(e.target.value)}
                      placeholder="0,00"
                      className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] tabular-nums"
                    />
                  </div>
                  <button
                    type="submit"
                    className="text-xs font-bold px-4 py-2 rounded-lg bg-[var(--red)] text-white"
                  >
                    Fechar caixa
                  </button>
                </form>

                {summary.diff !== null && summary.diff !== 0 && (
                  <p className="text-xs mt-2 text-[var(--muted)]">
                    {summary.diff > 0
                      ? `Sobrou ${brl(summary.diff)} (contado acima do esperado).`
                      : `Faltou ${brl(Math.abs(summary.diff))} (contado abaixo do esperado).`}
                  </p>
                )}

                {/* movimentos */}
                {cash.movements.length > 0 && (
                  <ul className="mt-3">
                    {cash.movements.map((m, i) => (
                      <li key={i} className="px-1 py-2 flex items-center gap-3 border-t border-[var(--border)]">
                        <span className={`text-xs font-extrabold ${m.direction === "in" ? "text-green-600" : "text-red-600"}`}>
                          {m.direction === "in" ? "↑" : "↓"}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-sm">{m.note || "—"}</span>
                        <span className="text-sm font-extrabold tabular-nums">{brl(m.amount_cents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* (c) Contas a pagar */}
          <section className="card mt-4 anim-rise" style={{ animationDelay: "240ms" }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">Contas a pagar</h2>
                <p className="text-[11px] text-[var(--muted)]">cadastre, edite e quite contas</p>
              </div>
            </div>

            {/* nova conta */}
            <form className="px-3 pb-3 flex flex-col sm:flex-row sm:items-end gap-2" action={doSaveConta}>
              <div className="flex-[2]">
                <label className="text-xs font-bold text-[var(--muted)]">Descrição</label>
                <input
                  type="text"
                  value={contaDesc}
                  onChange={(e) => setContaDesc(e.target.value)}
                  placeholder="ex.: fornecedor, aluguel…"
                  className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-[var(--muted)]">Valor (R$)</label>
                <input
                  type="text"
                  name="amount"
                  inputMode="decimal"
                  value={contaAmount}
                  onChange={(e) => setContaAmount(e.target.value)}
                  placeholder="0,00"
                  className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] tabular-nums"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-[var(--muted)]">Vencimento</label>
                <input
                  type="date"
                  name="due"
                  value={contaDue}
                  onChange={(e) => setContaDue(e.target.value)}
                  className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                />
              </div>
              <button
                type="submit"
                className="text-xs font-bold px-4 py-2 rounded-lg bg-[var(--red)] text-white"
              >
                Adicionar
              </button>
            </form>

            <ul className="mt-1 pb-2">
              {data.payable.map((c) => (
                <li key={c.id} className="px-3 py-3 border-t border-[var(--border)]">
                  {isPaying(c.id) ? (
                    <form className="flex flex-col sm:flex-row sm:items-end gap-2" action={doPagar}>
                      <div className="flex-1">
                        <label className="text-xs font-bold text-[var(--muted)]">Valor pago (R$)</label>
                        <input
                          type="text"
                          name="paid"
                          inputMode="decimal"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder={(c.amount_cents / 100).toFixed(2).replace(".", ",")}
                          className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] tabular-nums"
                        />
                      </div>
                      <button type="submit" className="text-xs font-bold px-4 py-2 rounded-lg bg-green-600 text-white">
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPayId(null); setPayAmount(""); }}
                        className="text-xs font-bold px-4 py-2 rounded-lg border border-[var(--border)]"
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{c.description}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {new Date(c.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                          {c.paid && c.paid_at && ` · pago em ${new Date(c.paid_at).toLocaleDateString("pt-BR")}`}
                        </p>
                      </div>
                      <span className={`text-xs font-extrabold px-2 py-1 rounded-full ${STATUS_BADGE[c.status]}`}>
                        {c.status}
                      </span>
                      <span className="text-sm font-extrabold tabular-nums">{brl(c.amount_cents)}</span>
                      {!c.paid && (
                        <button
                          type="button"
                          onClick={() => { setPayId(c.id); setPayAmount(""); }}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-600 text-white"
                        >
                          Pagar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => doDeleteConta(c.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--red)]"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {data.payable.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-[var(--muted)]">nenhuma conta cadastrada</li>
              )}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
