"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { brl, type Store } from "../../menu-data";
import { type OrderStatus } from "@/components/ui/status-badge";
import { STATUS_LABEL } from "@/lib/order-status";
import { waLink } from "@/lib/wa";

// Espelho do corpo GET /api/orders/track/[token] (D4)
type TrackOrder = {
  code: string; status: OrderStatus; type: "delivery" | "pickup";
  customer_name: string; phone_masked: string; neighborhood: string | null; notes: string | null;
  items: { name: string; qty: number; unit_price_cents: number; addons: { name: string; price_cents: number }[]; notes: string | null }[];
  subtotal_cents: number; delivery_fee_cents: number; total_cents: number;
  payment_method: string; change_for_cents: number | null;
  promised_at: string; created_at: string;
  canCancel: boolean; cancellation_reason: string | null;
};

const FLOW: OrderStatus[] = ["new", "confirmed", "preparing", "out", "delivered"];
const PAY: Record<string, string> = { cash: "Dinheiro", pix: "Pix", card_machine: "Maquininha" };
// preview: ?s=new|confirmed|preparing|out|delivered|cancelled troca o estado
const PREVIEW = ["new", "confirmed", "preparing", "out", "delivered", "cancelled"] as const;
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Manaus" }).format(new Date(iso));

export default function PedidoClient({ store, token }: { store: Store; token: string }) {
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [missing, setMissing] = useState(false);
  const [preview, setPreview] = useState<OrderStatus | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/orders/track/${token}`, { cache: "no-store" });
    if (r.status === 404) { setMissing(true); return; }
    if (r.ok) setOrder(await r.json());
  }, [token]);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (s && (PREVIEW as readonly string[]).includes(s)) setPreview(s as OrderStatus);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (missing) {
    return (
      <div className="min-h-screen bg-[#f4f1ec]">
        <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />
        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="font-display font-extrabold text-2xl tracking-tight">Pedido não encontrado.</p>
          <p className="text-sm text-stone-500 mt-1">Confira o link ou volte à vitrine.</p>
          <Link href={`/${store.slug}`} className="inline-block mt-5 bg-stone-900 text-white font-bold rounded-2xl px-6 py-3 text-sm">
            Voltar à vitrine
          </Link>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#f4f1ec]">
        <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />
        <main className="max-w-3xl mx-auto px-4 pb-16">
          <section className="mt-4 bg-stone-900 text-white rounded-3xl p-6 animate-pulse">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-300">localizando pedido…</p>
            <p className="font-display font-extrabold text-2xl mt-1">Buscando seu pedido…</p>
          </section>
        </main>
      </div>
    );
  }

  const status = preview ?? order.status;
  const canCancel = preview ? status === "new" || status === "confirmed" : order.canCancel;
  const stepIndex = Math.max(0, FLOW.indexOf(status === "ready" ? "preparing" : status));
  const changeLabel = order.change_for_cents != null ? `troco p/ ${brl(order.change_for_cents)}` : null;
  const waHref = waLink(store.whatsapp, `Olá! Sobre meu pedido #${order.code}`);
  const mins = Math.max(1, Math.round((new Date(order.promised_at).getTime() - new Date(order.created_at).getTime()) / 60000));
  const late = status !== "delivered" && status !== "cancelled" && new Date(order.promised_at).getTime() < Date.now();

  const confirmCancel = async () => {
    if (reason.trim().length < 3) {
      setReasonError("Conte o motivo com pelo menos 3 letras.");
      return;
    }
    const r = await fetch(`/api/orders/track/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }),
    });
    if (!r.ok) {
      const b = await r.json().catch(() => null);
      alert(b?.error?.message ?? "Não foi possível cancelar. Tente de novo.");
      return;
    }
    setCancelOpen(false);
    setReason("");
    await load();
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
                <>
                  <p className="text-sm text-stone-300 mt-1">chega ~{hhmm(order.promised_at)}</p>
                  {status !== "out" && (
                    <p className="text-sm text-stone-300 mt-0.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot" />
                      ~{mins} min
                    </p>
                  )}
                </>
              )}
              {late && <p className="text-sm mt-1 font-bold text-red-400">Passou do horário previsto.</p>}
              {status === "delivered" && <p className="text-sm text-stone-300 mt-1">Bom apetite! Obrigado por pedir com a gente.</p>}
              {status === "cancelled" && (
                <>
                  <p className="text-sm text-stone-300 mt-1">Sem cobrança — pagamento é só na entrega.</p>
                  {order.cancellation_reason && <p className="text-sm text-stone-400 mt-0.5">Motivo: {order.cancellation_reason}</p>}
                </>
              )}
            </div>
            <span className="text-5xl anim-drift select-none">{status === "cancelled" ? "🧾" : status === "delivered" ? "🎉" : "🛵"}</span>
          </div>
          {/* progresso */}
          {status !== "cancelled" && (
            <div className="mt-4">
              <div className="flex gap-1.5">
                {FLOW.map((f, i) => (
                  <div key={f} className={`flex-1 h-2 rounded-full transition-all ${i <= stepIndex ? "bg-gradient-to-r from-amber-300 to-orange-400" : "bg-white/15"}`} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                {FLOW.map((f, i) => (
                  <span key={f} className={i <= stepIndex ? "text-amber-200" : ""}>{STATUS_LABEL[f]}</span>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px] text-stone-500">atualizando sozinho a cada 15s · sem login, guarde este link</p>
        </section>

        {/* detalhes + itens */}
        <section className="mt-4 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "120ms" }}>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <p><span className="text-stone-400">Quem recebe:</span> <b>{order.customer_name}</b> <span className="text-stone-400">{order.phone_masked}</span></p>
            <p><span className="text-stone-400">{order.type === "delivery" ? "Entrega em:" : "Retirada ·"}</span> <b>{order.type === "delivery" ? (order.neighborhood ?? "—") : store.name}</b></p>
            <p><span className="text-stone-400">Pagamento:</span> <b>{PAY[order.payment_method] ?? order.payment_method}</b>{changeLabel && <span className="text-stone-500"> ({changeLabel})</span>}</p>
            <p><span className="text-stone-400">Total:</span> <b className="tabular-nums">{brl(order.total_cents)}</b></p>
          </div>
          <ul className="mt-3 divide-y divide-dashed border-t border-dashed">
            {order.items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="py-2.5 flex justify-between gap-2 text-sm">
                <span>{it.qty}× {it.name}{it.addons.length > 0 && <span className="text-stone-400"> (+ {it.addons.map((a) => a.name).join(", ")})</span>}</span>
                <span className="font-bold tabular-nums shrink-0">{brl(it.unit_price_cents * it.qty)}</span>
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
