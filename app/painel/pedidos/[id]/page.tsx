"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { STATUS_PT, ITEM_SETS, TODAY_ORDERS, type PanelOrder } from "../../mock";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FLOW: PanelOrder["status"][] = ["new", "confirmed", "preparing", "out", "delivered"];
const ACTOR_PT: Record<string, string> = { customer: "cliente", store: "loja", system: "sistema" };

function nextStatus(s: PanelOrder["status"], type: PanelOrder["type"]): PanelOrder["status"] | null {
  switch (s) {
    case "new": return "confirmed";
    case "confirmed": return "preparing";
    case "preparing": return type === "pickup" ? "ready" : "out";
    case "ready":
    case "out": return "delivered";
    default: return null;
  }
}

export default function PedidoDetalhe() {
  const id = useParams().id as string;
  const base = TODAY_ORDERS.find((o) => o.id === id);
  const [status, setStatus] = useState<PanelOrder["status"] | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const order = useMemo(() => {
    if (!base) return null;
    return { ...base, status: status ?? base.status };
  }, [base, status]);
  if (!order) notFound();

  const items = ITEM_SETS[Number(order.id) % ITEM_SETS.length];
  const subtotal = items.reduce((s, it) => s + it.unit * it.qty, 0);
  const fee = order.type === "delivery" ? 500 : 0;
  const next = nextStatus(order.status, order.type);
  const flowIdx = FLOW.indexOf(order.status === "ready" ? "out" : order.status);
  const waHref = `https://wa.me/5511999998888?text=${encodeURIComponent(`Olá ${order.customer}! Aqui é da Pizza do João, sobre o pedido #${order.code}.`)}`;

  const events = useMemo(() => {
    const evs: { label: string; actor: string; ago: string }[] = [];
    const upto = order.status === "cancelled" ? 0 : flowIdx;
    for (let i = 0; i <= upto && i < FLOW.length; i++) {
      evs.push({
        label: STATUS_PT[FLOW[i]],
        actor: i === 0 ? "cliente" : "loja",
        ago: `há ${order.minutesAgo + (upto - i) * 8} min`,
      });
    }
    if (order.status === "cancelled") {
      evs.push({ label: "Cancelado", actor: "loja", ago: `há ${Math.max(1, order.minutesAgo - 5)} min` });
    }
    return evs.reverse();
  }, [order, flowIdx]);

  const confirmCancel = () => {
    if (reason.trim().length < 3) {
      setReasonError("Motivo com pelo menos 3 letras.");
      return;
    }
    setStatus("cancelled");
    setCancelOpen(false);
  };

  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-16">
      <Link href="/painel/pedidos" className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-stone-500 hover:text-stone-900 transition-colors anim-rise">
        ← Voltar ao kanban
      </Link>

      {/* cabeçalho */}
      <div className="mt-2 bg-stone-900 text-white rounded-3xl shadow-xl p-5 sm:p-6 anim-rise texture-dots" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display font-extrabold text-3xl tracking-tight">#{order.code}</h1>
          <span className={`text-[11px] font-extrabold border rounded-full px-2.5 py-1 ${order.status === "cancelled" ? "bg-white/10 text-stone-300 border-white/15" : "bg-emerald-400/15 text-emerald-300 border-emerald-300/30"}`}>
            {STATUS_PT[order.status]}
          </span>
          <span className="ml-auto text-xs text-stone-400 tabular-nums">há {order.minutesAgo} min</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="bg-white/10 rounded-full px-2.5 py-1">{order.type === "delivery" ? "Entrega" : "Retirada"}</span>
          <span className="bg-white/10 rounded-full px-2.5 py-1">{order.payment}</span>
          <span className="bg-white/10 rounded-full px-2.5 py-1 tabular-nums">{brl(subtotal + fee)}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        {/* cliente */}
        <section className="bg-white border rounded-3xl shadow-sm p-5 anim-rise" style={{ animationDelay: "120ms" }}>
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-400">Cliente</h2>
          <p className="font-display font-extrabold text-lg mt-1">{order.customer}</p>
          <p className="text-sm text-stone-500 tabular-nums">(11) 98765-4321</p>
          <a href={waHref} target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 bg-[#25d366] hover:brightness-95 text-white text-sm font-bold rounded-xl px-4 py-2.5 transition-all">
            Chamar no WhatsApp
          </a>
          <div className="mt-4 pt-3 border-t border-dashed">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-400">
              {order.type === "delivery" ? "Entrega" : "Retirada"}
            </h2>
            {order.type === "delivery" ? (
              <p className="text-sm mt-1">Rua das Flores, 123 · Centro<br /><span className="text-stone-500">CEP 01234-567 · taxa {brl(fee)}</span></p>
            ) : (
              <p className="text-sm mt-1">Balcão — avisar quando chegar 📍</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-dashed text-sm">
            <span className="text-stone-400">Pagamento:</span> <b>{order.payment}</b>
            {order.payment === "Dinheiro" && <span className="text-stone-500"> · troco p/ R$ 150,00</span>}
          </div>
        </section>

        {/* itens */}
        <section className="bg-white border rounded-3xl shadow-sm p-5 anim-rise" style={{ animationDelay: "180ms" }}>
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-400">Itens · snapshot do pedido</h2>
          <ul className="mt-2 divide-y divide-dashed">
            {items.map((it) => (
              <li key={it.name} className="py-2.5 flex justify-between gap-2 text-sm">
                <span>
                  {it.qty}× <b>{it.name}</b>
                  {it.addons.length > 0 && <span className="block text-xs text-stone-500">+ {it.addons.join(", ")}</span>}
                  {it.notes && <span className="block text-xs text-stone-400 italic">“{it.notes}”</span>}
                </span>
                <span className="font-bold tabular-nums shrink-0">{brl(it.unit * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t border-dashed text-sm space-y-1">
            <div className="flex justify-between text-stone-500"><span>Subtotal</span><span className="tabular-nums">{brl(subtotal)}</span></div>
            <div className="flex justify-between text-stone-500"><span>Entrega</span><span className="tabular-nums">{order.type === "delivery" ? brl(fee) : "grátis"}</span></div>
            <div className="flex justify-between font-display font-extrabold text-lg"><span>Total</span><span className="tabular-nums">{brl(subtotal + fee)}</span></div>
          </div>
        </section>
      </div>

      {/* timeline */}
      <section className="mt-3 bg-white border rounded-3xl shadow-sm p-5 anim-rise" style={{ animationDelay: "240ms" }}>
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-400">Linha do tempo</h2>
        <ol className="mt-3 space-y-0">
          {events.map((e, i) => (
            <li key={`${e.label}-${i}`} className="flex gap-3">
              <span className="flex flex-col items-center">
                <span className={`w-3 h-3 rounded-full mt-1 ${i === 0 ? "bg-red-600 live-dot" : "bg-stone-300"}`} />
                {i < events.length - 1 && <span className="w-px flex-1 bg-stone-200 my-0.5" />}
              </span>
              <span className="pb-4 text-sm">
                <b>{e.label}</b> <span className="text-stone-400">· por {ACTOR_PT[e.actor] ?? e.actor} · {e.ago}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ações */}
      <section className="mt-3 flex flex-col sm:flex-row gap-2 anim-rise" style={{ animationDelay: "300ms" }}>
        {next ? (
          <button onClick={() => setStatus(next)}
            className="flex-1 bg-stone-900 hover:bg-stone-700 text-white font-extrabold rounded-2xl py-3.5 transition-all active:scale-[0.99]">
            Avançar → {STATUS_PT[next]}
          </button>
        ) : (
          order.status !== "cancelled" && (
            <span className="flex-1 text-center bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-2xl py-3.5 text-sm">
              ✓ Pedido finalizado
            </span>
          )
        )}
        {order.status !== "cancelled" && order.status !== "delivered" && (
          <button onClick={() => setCancelOpen(true)}
            className="flex-1 border-2 border-red-200 text-red-700 font-extrabold rounded-2xl py-3 hover:bg-red-50 transition-colors">
            Cancelar pedido
          </button>
        )}
        <Link href={`/painel/pedidos/${order.id}/print`}
          className="flex-1 text-center border border-stone-200 bg-white font-extrabold rounded-2xl py-3 hover:border-stone-400 transition-colors text-sm self-center">
          🖨 Imprimir 80mm
        </Link>
      </section>

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/50 backdrop-blur-[2px] p-4" onClick={() => setCancelOpen(false)}>
          <div className="anim-pop w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-display font-extrabold text-lg">Cancelar #{order.code}?</p>
            <p className="text-sm text-stone-500 mt-0.5">Motivo obrigatório (≥3 letras).</p>
            <input value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(""); }} autoFocus
              placeholder="Ex: sem entregador agora…" maxLength={200}
              className="mt-3 w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none" />
            {reasonError && <p className="text-xs font-bold text-red-600 mt-1.5">{reasonError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setCancelOpen(false)} className="flex-1 border border-stone-200 font-bold rounded-xl py-3 text-sm hover:bg-stone-50 transition-colors">Voltar</button>
              <button onClick={confirmCancel} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl py-3 text-sm transition-colors">Cancelar pedido</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
