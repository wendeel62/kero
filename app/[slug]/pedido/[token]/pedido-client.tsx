"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brl, type DemoOrder, type OrderStatus, type Store } from "../../menu-data";

const FLOW: { id: OrderStatus; label: string }[] = [
  { id: "new", label: "Novo" },
  { id: "confirmed", label: "Confirmado" },
  { id: "preparing", label: "Em preparo" },
  { id: "out", label: "Saiu p/ entrega" },
  { id: "delivered", label: "Entregue" },
];
const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Aguardando a loja",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto p/ retirada",
  out: "Saiu p/ entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};
// preview: ?s=new|confirmed|preparing|out|delivered|cancelled troca o estado
const PREVIEW = ["new", "confirmed", "preparing", "out", "delivered", "cancelled"] as const;

export default function PedidoClient({ store, token, order }: {
  store: Store; token: string; order: DemoOrder;
}) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (s && (PREVIEW as readonly string[]).includes(s)) setStatus(s as OrderStatus);
  }, []);

  useEffect(() => {
    // fase backend: polling do GET /api/orders/track/[token] a cada 15s
    const t = setInterval(() => {}, 15000);
    return () => clearInterval(t);
  }, [token]);

  const stepIndex = FLOW.findIndex((f) => f.id === status);
  const canCancel = status === "new" || status === "confirmed"; // spec: cliente cancela em new/confirmed
  const total = order.subtotal_cents + order.fee_cents;
  const waHref = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`Olá! Fiz o pedido #${order.code} pelo Kero.`)}`;

  const confirmCancel = () => {
    if (reason.trim().length < 3) {
      setReasonError("Conte o motivo com pelo menos 3 letras.");
      return;
    }
    // fase backend: POST /api/orders/track/[token]/cancel (set_order_status … 'customer')
    setStatus("cancelled");
    setCancelOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b shadow-[0_1px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href={`/${store.slug}`} className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-lg transition-colors" aria-label="Voltar ao cardápio">←</Link>
          <span className="font-display font-extrabold tracking-tight">Acompanhar pedido</span>
          <span className="ml-auto text-xs text-stone-400 font-medium truncate">{store.name}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-16">
        <ol className="flex items-center gap-1.5 mt-5 anim-rise" aria-label="Etapas do pedido">
          {["Sacola", "Checkout", "Receber"].map((s, i) => (
            <li key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
              <span className="flex items-center gap-2 text-[12px] font-extrabold whitespace-nowrap text-stone-900">
                <span className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] bg-stone-900 text-white shadow">
                  {i < 2 ? "✓" : i + 1}
                </span>
                {s}
              </span>
              {i < 2 && <span className="flex-1 h-px bg-stone-300 mx-1" />}
            </li>
          ))}
        </ol>

        {/* status hero */}
        <section className="mt-4 bg-stone-900 text-white rounded-3xl shadow-[0_20px_50px_-16px_rgba(28,25,23,0.55)] p-6 texture-dots anim-rise overflow-hidden relative" style={{ animationDelay: "60ms" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-300">pedido #{order.code}</p>
              <p className="font-display font-extrabold text-2xl mt-1 tracking-tight">
                {status === "cancelled" ? "Pedido cancelado" : STATUS_LABEL[status]}
              </p>
              {status !== "cancelled" && status !== "delivered" && (
                <p className="text-sm text-stone-300 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot" />
                  chega em ~{order.promisedInMin} min
                </p>
              )}
              {status === "delivered" && <p className="text-sm text-stone-300 mt-1">Bom apetite! Obrigado por pedir com a gente.</p>}
              {status === "cancelled" && <p className="text-sm text-stone-300 mt-1">Sem cobrança — pagamento é só na entrega.</p>}
            </div>
            <span className="text-5xl anim-drift select-none">{status === "cancelled" ? "🧾" : status === "delivered" ? "🎉" : "🛵"}</span>
          </div>
          {/* progresso */}
          {status !== "cancelled" && (
            <div className="mt-4">
              <div className="flex gap-1.5">
                {FLOW.map((f, i) => (
                  <div key={f.id} className={`flex-1 h-2 rounded-full transition-all ${i <= stepIndex ? "bg-gradient-to-r from-amber-300 to-orange-400" : "bg-white/15"}`} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                {FLOW.map((f, i) => (
                  <span key={f.id} className={i <= stepIndex ? "text-amber-200" : ""}>{f.label}</span>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px] text-stone-500">atualizando sozinho a cada 15s · sem login, guarde este link</p>
        </section>

        {/* detalhes + itens */}
        <section className="mt-4 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "120ms" }}>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <p><span className="text-stone-400">Quem recebe:</span> <b>{order.customer}</b> <span className="text-stone-400">{order.phoneMasked}</span></p>
            <p><span className="text-stone-400">{order.type === "delivery" ? "Entrega em:" : "Retirada ·"}</span> <b>{order.type === "delivery" ? order.neighborhood : store.name}</b></p>
            <p><span className="text-stone-400">Pagamento:</span> <b>{order.paymentLabel}</b>{order.changeLabel && <span className="text-stone-500"> ({order.changeLabel})</span>}</p>
            <p><span className="text-stone-400">Total:</span> <b className="tabular-nums">{brl(total)}</b></p>
          </div>
          <ul className="mt-3 divide-y divide-dashed border-t border-dashed">
            {order.items.map((it) => (
              <li key={it.name} className="py-2.5 flex justify-between gap-2 text-sm">
                <span>{it.qty}× {it.name}{it.addons.length > 0 && <span className="text-stone-400"> (+ {it.addons.join(", ")})</span>}</span>
                <span className="font-bold tabular-nums shrink-0">{brl(it.unit_cents * it.qty)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ações */}
        <section className="mt-4 grid sm:grid-cols-2 gap-2.5 anim-rise" style={{ animationDelay: "180ms" }}>
          <a href={waHref} target="_blank" rel="noreferrer"
            className="bg-[#25d366] hover:brightness-95 text-white font-bold rounded-2xl py-3.5 text-center shadow-lg transition-all active:scale-[0.99]">
            Chamar no WhatsApp
          </a>
          {canCancel && !cancelOpen && (
            <button onClick={() => setCancelOpen(true)}
              className="border-2 border-red-200 text-red-700 font-bold rounded-2xl py-3 hover:bg-red-50 transition-colors">
              Cancelar pedido
            </button>
          )}
        </section>

        {cancelOpen && (
          <section className="mt-3 bg-white border border-red-200 rounded-3xl shadow-sm p-4 sm:p-6 anim-pop">
            <p className="font-display font-extrabold">Cancelar pedido #{order.code}?</p>
            <p className="text-sm text-stone-500 mt-0.5">A loja é avisada na hora. Só vale p/ pedidos ainda não iniciados.</p>
            <label htmlFor="motivo" className="text-[13px] font-bold text-stone-700 block mt-3">Motivo do cancelamento</label>
            <input id="motivo" value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(""); }}
              placeholder="Ex: fiz errado, demora muito…" maxLength={200} className="mt-1 w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none" />
            {reasonError && <p className="text-xs font-bold text-red-600 mt-1.5">{reasonError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setCancelOpen(false)} className="flex-1 border border-stone-200 font-bold rounded-xl py-3 text-sm hover:bg-stone-50 transition-colors">
                Manter pedido
              </button>
              <button onClick={confirmCancel} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl py-3 text-sm transition-colors">
                Confirmar cancelamento
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
