"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAwaitingCount, getKanban, getRealtimeContext } from "@/lib/painel";
import { playNewOrderSound, updateFaviconBadge, usePanelLive } from "@/lib/painel-live";
import type { PanelOrder } from "@/lib/painel-utils";
import { PERIOD_KINDS, PERIOD_LABEL, type PeriodKind } from "@/lib/period";
import { StatusBadge } from "@/components/ui/status-badge";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Col = { id: PanelOrder["status"] | "done"; label: string; tint: string; dot: string };
const COLS: Col[] = [
  { id: "new", label: "Novos", tint: "bg-[var(--red-soft)] border-[var(--border)]", dot: "bg-[var(--red)]" },
  { id: "confirmed", label: "Confirmados", tint: "bg-[var(--amber-soft)] border-[var(--border)]", dot: "bg-[var(--amber)]" },
  { id: "preparing", label: "Em preparo", tint: "bg-[var(--info-soft)] border-[var(--border)]", dot: "bg-[var(--info)]" },
  { id: "out", label: "Pronto / Em rota", tint: "bg-[var(--green-soft)] border-[var(--border)]", dot: "bg-[var(--green)]" },
  { id: "done", label: "Entregues", tint: "bg-[var(--pill-bg)] border-[var(--border)]", dot: "bg-[var(--muted)]" },
];
// spec order-status.ts: new→confirmed→preparing→ready|out→delivered
function nextStatus(o: PanelOrder): PanelOrder["status"] | null {
  switch (o.status) {
    case "new": return "confirmed";
    case "confirmed": return "preparing";
    case "preparing": return o.type === "pickup" ? "ready" : "out";
    case "ready":
    case "out": return "delivered";
    default: return null;
  }
}
const NEXT_LABEL: Record<string, string> = {
  confirmed: "Confirmar", preparing: "P/ preparo", ready: "Pronto", out: "Saiu p/ entrega", delivered: "Entregar",
};

type TypeFilter = "all" | "delivery" | "pickup";

export default function Kanban() {
  const [orders, setOrders] = useState<PanelOrder[] | null>(null);
  const [anteriores, setAnteriores] = useState<PanelOrder[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [liveMsg, setLiveMsg] = useState("");
  const [period, setPeriod] = useState<PeriodKind>("today");
  const [type, setType] = useState<TypeFilter>("all");
  useEffect(() => {
    getKanban(period, type).then((k) => {
      setOrders(k.orders);
      setAnteriores(k.anteriores);
      updateFaviconBadge(k.orders.filter((o) => o.status === "new").length);
    }).catch(() => setOrders([]));
    getRealtimeContext().then((c) => setStoreId(c.storeId)).catch(() => {});
  }, [period, type]);

  const refreshBadge = () => {
    getAwaitingCount().then((s) => updateFaviconBadge(s.awaiting)).catch(() => {});
  };

  // Realtime (SPEC §9/§11): insere/atualiza sem reload; som+vozes só no novo
  usePanelLive(storeId, {
    onInsert: (o) => {
      setOrders((prev) => {
        if (!prev || prev.some((x) => x.id === o.id)) return prev;
        return [o, ...prev];
      });
      if (o.status === "new") {
        playNewOrderSound();
        setLiveMsg(`Novo pedido #${o.code} de ${o.customer}`);
      }
      refreshBadge();
    },
    onUpdate: (o) => {
      setOrders((prev) => {
        if (!prev) return prev;
        if (prev.some((x) => x.id === o.id)) return prev.map((x) => (x.id === o.id ? o : x));
        // fora da janela inicial (ex.: criado antes do load): entra se não finalizado
        return ["new", "confirmed", "preparing", "ready", "out"].includes(o.status) ? [o, ...prev] : prev;
      });
      refreshBadge();
    },
    onLive: (ok) => setLive(ok),
  });

  // fallback SPEC §9: sem Realtime, polling a cada 30s + indicador
  useEffect(() => {
    if (live || !storeId) return;
    const t = setInterval(() => {
      getKanban(period, type).then((k) => {
        setOrders(k.orders);
        setAnteriores(k.anteriores);
        updateFaviconBadge(k.orders.filter((o) => o.status === "new").length);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [live, storeId, period, type]);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [advanceError, setAdvanceError] = useState("");

  // transição via API-02 (RPC set_order_status): otimista, reverte se o banco recusar
  const transition = async (id: string, status: PanelOrder["status"], reason?: string) => {
    const prev = orders;
    setOrders((os) => (os ?? []).map((o) => (o.id === id ? { ...o, status } : o)));
    setAdvanceError("");
    const r = await fetch(`/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, reason: reason ?? null }),
    });
    if (!r.ok) {
      setOrders(prev);
      const j = await r.json().catch(() => null);
      return { ok: false as const, message: j?.error?.message ?? "O banco recusou a transição." };
    }
    return { ok: true as const, message: "" };
  };

  const advance = async (id: string) => {
    const o = (orders ?? []).find((x) => x.id === id);
    const next = o && nextStatus(o);
    if (!next) return;
    const r = await transition(id, next);
    if (!r.ok) setAdvanceError(`${r.message} Recarregue e tente de novo.`);
  };

  const confirmCancel = async () => {
    if (reason.trim().length < 3) {
      setReasonError("Motivo com pelo menos 3 letras (exige a spec).");
      return;
    }
    const ok = await transition(cancelId!, "cancelled", reason.trim());
    if (!ok.ok) {
      setReasonError(ok.message);
      return;
    }
    setCancelId(null);
    setReason("");
    setReasonError("");
  };

  const cancelled = useMemo(() => (orders ?? []).filter((o) => o.status === "cancelled"), [orders]);
  // rótulo do período (o período selecionado, não "hoje" fixo)
  const periodLabel = PERIOD_LABEL[period];
  const colOrders = (c: Col["id"]) =>
    c === "done"
      ? (orders ?? []).filter((o) => o.status === "delivered")
      : c === "out"
        ? (orders ?? []).filter((o) => o.status === "out" || o.status === "ready")
        : (orders ?? []).filter((o) => o.status === c);
  const awaiting = (orders ?? []).filter((o) => o.status === "new").length;

  if (!orders) {
    return (
      <main className="admin-content">
        <p className="text-sm text-[var(--muted)] animate-pulse">Carregando pedidos…</p>
      </main>
    );
  }

  return (
    <main className="admin-content">
      <div className="flex flex-wrap items-end gap-3 anim-rise">
        <p className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-[var(--green)] live-dot" : "bg-[var(--amber)] animate-pulse"}`} />
          {live ? "tempo real · não finalizados + hoje" : "Reconectando… (atualizando a cada 30s)"}
          {awaiting > 0 && <b className="text-[var(--red)]">· {awaiting} aguardando ação</b>}
        </p>
      </div>

      <p className="sr-only" aria-live="polite">{liveMsg}</p>

      {advanceError && (
        <p className="alert-banner anim-pop mt-3" role="alert">{advanceError}</p>
      )}

      {/* Filtros de período e tipo */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {PERIOD_KINDS.map((k) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                period === k
                  ? "bg-[var(--text)] text-[var(--surface)]"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}>
              {PERIOD_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {(["all", "delivery", "pickup"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                type === t
                  ? "bg-[var(--text)] text-[var(--surface)]"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}>
              {t === "all" ? "Todos" : t === "delivery" ? "Entrega" : "Retirada"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-4 snap-x">
        {COLS.map((col, ci) => {
          const list = colOrders(col.id);
          return (
            <section key={col.id} style={{ animationDelay: `${ci * 70}ms` }}
              className={`anim-rise snap-start shrink-0 w-[280px] rounded-[var(--radius-card)] border p-2.5 ${col.tint}`}>
              <header className="flex items-center gap-2 px-1.5 py-1.5">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">{col.label}</h2>
                <span className="ml-auto text-[11px] font-extrabold tabular-nums text-[var(--muted)] bg-[var(--surface)] rounded-full px-2 py-0.5">{list.length}</span>
              </header>
              <div className="space-y-2">
                {list.map((o) => {
                  const late = o.status === "new" ? o.statusMinutes > 10 : o.statusMinutes > 30;
                  const next = nextStatus(o);
                  return (
                    <article key={`${o.id}-${o.status}`} className={`card p-3.5 ${late ? "border-[var(--red)]" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm bg-[var(--pill-bg)] rounded-lg px-2 py-0.5">#{o.code}</span>
                        {late ? (
                          <span className="text-[11px] font-extrabold text-[var(--red)]">há {o.statusMinutes} min 🔴</span>
                        ) : (
                          <span className="text-[11px] font-medium text-[var(--muted)] tabular-nums">há {o.statusMinutes} min</span>
                        )}
                        <Link href={`/painel/pedidos/${o.id}`} aria-label={`Detalhe do pedido ${o.code}`}
                          className="ml-auto text-[var(--muted)] hover:text-[var(--text)] font-bold transition-colors">›</Link>
                      </div>
                      <p className="text-sm font-bold mt-1.5">{o.customer}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="text-[11px] font-bold bg-[var(--pill-bg)] rounded-full px-2 py-0.5">{o.type === "delivery" ? "Entrega" : "Retirada"}</span>
                        <span className="text-[11px] font-bold bg-[var(--pill-bg)] rounded-full px-2 py-0.5">{o.payment}</span>
                      </div>
                      <p className="font-extrabold tabular-nums mt-1.5">{brl(o.total_cents)}</p>
                      {o.status === "new" && (
                        <p className="text-[11px] font-bold text-[var(--red)] mt-0.5">Aguardando {o.statusMinutes} min</p>
                      )}
                      {next && (
                        <div className="flex gap-1.5 mt-2.5">
                          <button onClick={() => advance(o.id)}
                            className="btn btn--primary flex-1 !min-h-0 text-[13px] font-extrabold py-2 transition-all active:scale-[0.98]">
                            {NEXT_LABEL[next]} →
                          </button>
                          <button onClick={() => { setCancelId(o.id); setReason(""); setReasonError(""); }} aria-label={`Cancelar pedido ${o.code}`}
                            className="btn btn--ghost px-3 text-[13px] font-bold text-[var(--muted)] hover:text-[var(--red)] transition-colors">
                            ✕
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
                {list.length === 0 && (
                  <p className="text-center text-xs text-[var(--muted)] py-6">coluna zerada ✓</p>
                )}
              </div>
            </section>
          );
        })}

        {/* Coluna "Anteriores" (D7): não finalizados criados antes do período */}
        {anteriores.length > 0 && (
          <section className="anim-rise snap-start shrink-0 w-[280px] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
            <header className="flex items-center gap-2 px-1.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--muted)]" />
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">Anteriores</h2>
              <span className="ml-auto text-[11px] font-extrabold tabular-nums text-[var(--muted)] bg-[var(--surface)] rounded-full px-2 py-0.5">{anteriores.length}</span>
            </header>
            <div className="space-y-2">
              {anteriores.map((o) => {
                const late = o.status === "new" ? o.statusMinutes > 10 : o.statusMinutes > 30;
                const next = nextStatus(o);
                return (
                  <article key={`${o.id}-${o.status}`} className={`card p-3.5 ${late ? "border-[var(--red)]" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm bg-[var(--pill-bg)] rounded-lg px-2 py-0.5">#{o.code}</span>
                      {late ? (
                        <span className="text-[11px] font-extrabold text-[var(--red)]">há {o.statusMinutes} min 🔴</span>
                      ) : (
                        <span className="text-[11px] font-medium text-[var(--muted)] tabular-nums">há {o.statusMinutes} min</span>
                      )}
                      <Link href={`/painel/pedidos/${o.id}`} aria-label={`Detalhe do pedido ${o.code}`}
                        className="ml-auto text-[var(--muted)] hover:text-[var(--text)] font-bold transition-colors">›</Link>
                    </div>
                    <p className="text-sm font-bold mt-1.5">{o.customer}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[11px] font-bold bg-[var(--pill-bg)] rounded-full px-2 py-0.5">{o.type === "delivery" ? "Entrega" : "Retirada"}</span>
                      <span className="text-[11px] font-bold bg-[var(--pill-bg)] rounded-full px-2 py-0.5">{o.payment}</span>
                    </div>
                    <p className="font-extrabold tabular-nums mt-1.5">{brl(o.total_cents)}</p>
                    {o.status === "new" && (
                      <p className="text-[11px] font-bold text-[var(--red)] mt-0.5">Aguardando {o.statusMinutes} min</p>
                    )}
                    {next && (
                      <div className="flex gap-1.5 mt-2.5">
                        <button onClick={() => advance(o.id)}
                          className="btn btn--primary flex-1 !min-h-0 text-[13px] font-extrabold py-2 transition-all active:scale-[0.98]">
                          {NEXT_LABEL[next]} →
                        </button>
                        <button onClick={() => { setCancelId(o.id); setReason(""); setReasonError(""); }} aria-label={`Cancelar pedido ${o.code}`}
                          className="btn btn--ghost px-3 text-[13px] font-bold text-[var(--muted)] hover:text-[var(--red)] transition-colors">
                          ✕
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* cancelados de hoje (colapsada) */}
        <section className="snap-start shrink-0 w-[280px] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--text)] text-[var(--surface)] p-2.5 self-start">
          <details>
            <summary className="flex items-center gap-2 px-1.5 py-1.5 cursor-pointer list-none">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">Cancelados · {periodLabel}</h2>
              <span className="ml-auto text-[11px] font-extrabold tabular-nums bg-[var(--pill-bg)] rounded-full px-2 py-0.5">{cancelled.length}</span>
            </summary>
            <div className="space-y-2 mt-1">
              {cancelled.map((o) => (
                <div key={o.id} className="bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl p-3">
                  <p className="text-sm font-bold">#{o.code} · {o.customer}</p>
                  <p className="text-[11px] text-[var(--muted)] mt-1 flex items-center gap-1.5"><StatusBadge status={o.status} size="sm" /><span>{brl(o.total_cents)}</span></p>
                </div>
              ))}
              {cancelled.length === 0 && <p className="text-xs text-[var(--muted)] px-1.5 py-3">nenhum cancelamento hoje ✓</p>}
            </div>
          </details>
        </section>
      </div>

      {/* diálogo de cancelamento */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" onClick={() => setCancelId(null)}>
          <div className="anim-pop w-full max-w-sm card p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-extrabold text-lg">Cancelar pedido?</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">O cliente é avisado. Motivo obrigatório (≥3 letras).</p>
            <input value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(""); }} autoFocus
              placeholder="Ex: sem entregador agora…" maxLength={200}
              className="mt-3 w-full text-sm border border-[var(--border)] rounded-[var(--radius-button)] px-3.5 py-2.5 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none" />
            {reasonError && <p className="text-xs font-bold text-[var(--red)] mt-1.5">{reasonError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setCancelId(null)} className="btn btn--ghost flex-1 py-3 text-sm">
                Voltar
              </button>
              <button onClick={confirmCancel} className="btn btn--danger flex-1 py-3 text-sm">
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
