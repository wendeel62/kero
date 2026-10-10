"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_PT, TODAY_ORDERS, type PanelOrder } from "../mock";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Col = { id: PanelOrder["status"] | "done"; label: string; tint: string; dot: string };
const COLS: Col[] = [
  { id: "new", label: "Novos", tint: "bg-red-50/70 border-red-100", dot: "bg-red-500" },
  { id: "confirmed", label: "Confirmados", tint: "bg-amber-50/70 border-amber-100", dot: "bg-amber-500" },
  { id: "preparing", label: "Em preparo", tint: "bg-blue-50/70 border-blue-100", dot: "bg-blue-500" },
  { id: "out", label: "Pronto / Em rota", tint: "bg-emerald-50/70 border-emerald-100", dot: "bg-emerald-500" },
  { id: "done", label: "Entregues", tint: "bg-stone-100/70 border-stone-200", dot: "bg-stone-400" },
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

export default function Kanban() {
  // fase backend: lista via RLS + Realtime (orders por store_id) + som/badge
  const [orders, setOrders] = useState<PanelOrder[]>(TODAY_ORDERS);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const advance = (id: string) =>
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: nextStatus(o) ?? o.status } : o)));

  const confirmCancel = () => {
    if (reason.trim().length < 3) {
      setReasonError("Motivo com pelo menos 3 letras (exige a spec).");
      return;
    }
    // fase backend: set_order_status(…, 'cancelled', motivo, actor='store')
    setOrders((os) => os.map((o) => (o.id === cancelId ? { ...o, status: "cancelled" } : o)));
    setCancelId(null);
    setReason("");
    setReasonError("");
  };

  const cancelled = useMemo(() => orders.filter((o) => o.status === "cancelled"), [orders]);
  const colOrders = (c: Col["id"]) =>
    c === "done"
      ? orders.filter((o) => o.status === "delivered")
      : c === "out"
        ? orders.filter((o) => o.status === "out" || o.status === "ready")
        : orders.filter((o) => o.status === c);
  const awaiting = orders.filter((o) => o.status === "new").length;

  return (
    <main className="p-4 sm:p-8 max-w-[1400px] mx-auto pb-16">
      <div className="flex flex-wrap items-end gap-3 anim-rise">
        <div>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight">Pedidos</h1>
          <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
            tempo real · não finalizados + hoje
            {awaiting > 0 && <b className="text-red-600">· {awaiting} aguardando ação</b>}
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-4 snap-x">
        {COLS.map((col, ci) => {
          const list = colOrders(col.id);
          return (
            <section key={col.id} style={{ animationDelay: `${ci * 70}ms` }}
              className={`anim-rise snap-start shrink-0 w-[280px] rounded-3xl border p-2.5 ${col.tint}`}>
              <header className="flex items-center gap-2 px-1.5 py-1.5">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-600">{col.label}</h2>
                <span className="ml-auto text-[11px] font-extrabold tabular-nums text-stone-400 bg-white/70 rounded-full px-2 py-0.5">{list.length}</span>
              </header>
              <div className="space-y-2">
                {list.map((o) => {
                  const late = o.status === "new" && o.minutesAgo > 10; // spec: vermelho após 10 min em new
                  const next = nextStatus(o);
                  return (
                    <article key={`${o.id}-${o.status}`} className={`anim-pop bg-white border rounded-2xl shadow-sm p-3.5 ${late ? "border-red-200 ring-1 ring-red-100" : "border-stone-100"}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-extrabold text-sm bg-stone-100 rounded-lg px-2 py-0.5">#{o.code}</span>
                        {late ? (
                          <span className="text-[11px] font-extrabold text-red-600">há {o.minutesAgo} min 🔴</span>
                        ) : (
                          <span className="text-[11px] font-medium text-stone-400 tabular-nums">há {o.minutesAgo} min</span>
                        )}
                        <Link href={`/painel/pedidos/${o.id}`} aria-label={`Detalhe do pedido ${o.code}`}
                          className="ml-auto text-stone-300 hover:text-stone-700 font-bold transition-colors">›</Link>
                      </div>
                      <p className="text-sm font-bold mt-1.5">{o.customer}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="text-[11px] font-bold bg-stone-100 rounded-full px-2 py-0.5">{o.type === "delivery" ? "Entrega" : "Retirada"}</span>
                        <span className="text-[11px] font-bold bg-stone-100 rounded-full px-2 py-0.5">{o.payment}</span>
                      </div>
                      <p className="font-display font-extrabold tabular-nums mt-1.5">{brl(o.total_cents)}</p>
                      {o.status === "new" && (
                        <p className="text-[11px] font-bold text-red-600 mt-0.5">Aguardando {o.minutesAgo} min</p>
                      )}
                      {next && (
                        <div className="flex gap-1.5 mt-2.5">
                          <button onClick={() => advance(o.id)}
                            className="flex-1 bg-stone-900 hover:bg-stone-700 text-white text-[13px] font-extrabold rounded-xl py-2 transition-all active:scale-[0.98]">
                            {NEXT_LABEL[next]} →
                          </button>
                          <button onClick={() => { setCancelId(o.id); setReason(""); setReasonError(""); }} aria-label={`Cancelar pedido ${o.code}`}
                            className="px-3 text-[13px] font-bold text-stone-400 hover:text-red-600 border border-stone-200 hover:border-red-200 rounded-xl transition-colors">
                            ✕
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
                {list.length === 0 && (
                  <p className="text-center text-xs text-stone-400 py-6">coluna zerada ✓</p>
                )}
              </div>
            </section>
          );
        })}

        {/* cancelados de hoje (colapsada) */}
        <section className="snap-start shrink-0 w-[280px] rounded-3xl border border-stone-200 bg-stone-900 text-white p-2.5 self-start">
          <details>
            <summary className="flex items-center gap-2 px-1.5 py-1.5 cursor-pointer list-none">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-300">Cancelados · hoje</h2>
              <span className="ml-auto text-[11px] font-extrabold tabular-nums bg-white/10 rounded-full px-2 py-0.5">{cancelled.length}</span>
            </summary>
            <div className="space-y-2 mt-1">
              {cancelled.map((o) => (
                <div key={o.id} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                  <p className="text-sm font-bold">#{o.code} · {o.customer}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">{STATUS_PT[o.status]} · {brl(o.total_cents)} · motivo ≥3 chars</p>
                </div>
              ))}
              {cancelled.length === 0 && <p className="text-xs text-stone-400 px-1.5 py-3">nenhum cancelamento hoje ✓</p>}
            </div>
          </details>
        </section>
      </div>

      {/* diálogo de cancelamento */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/50 backdrop-blur-[2px] p-4" onClick={() => setCancelId(null)}>
          <div className="anim-pop w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-display font-extrabold text-lg">Cancelar pedido?</p>
            <p className="text-sm text-stone-500 mt-0.5">O cliente é avisado. Motivo obrigatório (≥3 letras).</p>
            <input value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(""); }} autoFocus
              placeholder="Ex: sem entregador agora…" maxLength={200}
              className="mt-3 w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none" />
            {reasonError && <p className="text-xs font-bold text-red-600 mt-1.5">{reasonError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setCancelId(null)} className="flex-1 border border-stone-200 font-bold rounded-xl py-3 text-sm hover:bg-stone-50 transition-colors">
                Voltar
              </button>
              <button onClick={confirmCancel} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl py-3 text-sm transition-colors">
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
