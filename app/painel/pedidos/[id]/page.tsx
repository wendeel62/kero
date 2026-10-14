"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { getPedido } from "@/lib/painel";
import { STATUS_LABEL as STATUS_PT, type PanelDetail, type PanelOrder } from "@/lib/painel-utils";
import { StatusBadge } from "@/components/ui/status-badge";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPhone = (p: string) =>
  p.length === 11 ? `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`
  : p.length === 10 ? `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}` : p;
const fmtQuando = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "agora mesmo" : `há ${m} min`;
};

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
  const [order, setOrder] = useState<PanelDetail | null | undefined>(undefined);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [advanceError, setAdvanceError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const { order: o } = await getPedido(id);
    setOrder(o);
  }, [id]);
  useEffect(() => { reload().catch(() => setOrder(null)); }, [reload]);

  if (order === undefined) {
    return (
      <main className="admin-content">
        <p className="text-sm text-[var(--muted)] animate-pulse">Carregando pedido…</p>
      </main>
    );
  }
  if (order === null) notFound();

  const items = order.items;
  const subtotal = order.subtotal;
  const fee = order.type === "delivery" ? order.fee : 0;
  const next = nextStatus(order.status, order.type);
  const waHref = `https://wa.me/55${order.phone}?text=${encodeURIComponent(`Olá ${order.customer}! Aqui é da loja, sobre o pedido #${order.code}.`)}`;

  const timeline = [...order.events].reverse();

  const transition = async (status: PanelOrder["status"], reason?: string) => {
    setBusy(true);
    setReasonError("");
    setAdvanceError("");
    const r = await fetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, reason: reason ?? null }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      const msg = j?.error?.message ?? "O banco recusou a transição.";
      if (status === "cancelled") setReasonError(msg);
      else setAdvanceError(msg);
      return false;
    }
    await reload();
    return true;
  };

  const confirmCancel = async () => {
    if (reason.trim().length < 3) {
      setReasonError("Motivo com pelo menos 3 letras.");
      return;
    }
    if (await transition("cancelled", reason.trim())) setCancelOpen(false);
  };

  return (
    <main className="admin-content">
      <Link href="/painel/pedidos" className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--muted)] hover:text-[var(--text)] transition-colors anim-rise">
        ← Voltar ao kanban
      </Link>

      {/* cabeçalho */}
      <div className="mt-2 bg-[var(--text)] text-white rounded-3xl shadow-xl p-5 sm:p-6 anim-rise texture-dots" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-extrabold text-3xl tracking-tight">#{order.code}</h1>
          <span className="rounded-full ring-1 ring-white/25">
            <StatusBadge status={order.status} size="sm" />
          </span>
          <span className="ml-auto text-xs text-[var(--muted)] tabular-nums">há {order.minutesAgo} min</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="bg-[var(--surface-2)] text-[var(--text)] rounded-full px-2.5 py-1">{order.type === "delivery" ? "Entrega" : "Retirada"}</span>
          <span className="bg-[var(--surface-2)] text-[var(--text)] rounded-full px-2.5 py-1">{order.payment}</span>
          <span className="bg-[var(--surface-2)] text-[var(--text)] rounded-full px-2.5 py-1 tabular-nums">{brl(subtotal + fee)}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        {/* cliente */}
        <section className="bg-[var(--surface)] border rounded-3xl shadow-sm p-5 anim-rise" style={{ animationDelay: "120ms" }}>
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">Cliente</h2>
          <p className="font-extrabold text-lg mt-1">{order.customer}</p>
          <p className="text-sm text-[var(--muted)] tabular-nums">{fmtPhone(order.phone)}</p>
          <a href={waHref} target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 bg-[#25d366] hover:brightness-95 text-white text-sm font-bold rounded-xl px-4 py-2.5 transition-all">
            Chamar no WhatsApp
          </a>
          <div className="mt-4 pt-3 border-t border-dashed">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
              {order.type === "delivery" ? "Entrega" : "Retirada"}
            </h2>
            {order.type === "delivery" ? (
              <p className="text-sm mt-1">
                {order.address?.street}, {order.address?.number}{order.address?.complement ? ` · ${order.address.complement}` : ""} · {order.address?.neighborhood_name}<br /><span className="text-[var(--muted)]">CEP {order.address?.cep} · taxa {brl(fee)}</span>
              </p>
            ) : (
              <p className="text-sm mt-1">Balcão — avisar quando chegar 📍</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-dashed text-sm">
            <span className="text-[var(--muted)]">Pagamento:</span> <b>{order.payment}</b>
            {order.paymentMethod === "cash" && order.changeFor != null && (
              <span className="text-[var(--muted)]"> · troco p/ {brl(order.changeFor)}</span>
            )}
            {order.notes && <span className="block text-xs text-[var(--muted)] italic mt-1">“{order.notes}”</span>}
          </div>
        </section>

        {/* itens */}
        <section className="bg-[var(--surface)] border rounded-3xl shadow-sm p-5 anim-rise" style={{ animationDelay: "180ms" }}>
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">Itens · snapshot do pedido</h2>
          <ul className="mt-2 divide-y divide-dashed">
            {items.map((it) => (
              <li key={it.name} className="py-2.5 flex justify-between gap-2 text-sm">
                <span>
                  {it.qty}× <b>{it.name}</b>
                  {it.addons.length > 0 && <span className="block text-xs text-[var(--muted)]">+ {it.addons.join(", ")}</span>}
                  {it.notes && <span className="block text-xs text-[var(--muted)] italic">“{it.notes}”</span>}
                </span>
                <span className="font-bold tabular-nums shrink-0">{brl(it.unit * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t border-dashed text-sm space-y-1">
            <div className="flex justify-between text-[var(--muted)]"><span>Subtotal</span><span className="tabular-nums">{brl(subtotal)}</span></div>
            {order.type === "delivery" && <div className="flex justify-between text-[var(--muted)]"><span>Entrega</span><span className="tabular-nums">{brl(fee)}</span></div>}
            <div className="flex justify-between font-extrabold text-lg"><span>Total</span><span className="tabular-nums">{brl(subtotal + fee)}</span></div>
          </div>
        </section>
      </div>

      {/* timeline */}
      <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm p-5 anim-rise" style={{ animationDelay: "240ms" }}>
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">Linha do tempo</h2>
        <ol className="mt-3 space-y-0">
          {timeline.map((e, i) => (
            <li key={`${e.label}-${i}`} className="flex gap-3">
              <span className="flex flex-col items-center">
                <span className={`w-3 h-3 rounded-full mt-1 ${i === 0 ? "bg-[var(--red)] live-dot" : "bg-[var(--muted)]"}`} />
                {i < timeline.length - 1 && <span className="w-px flex-1 bg-[var(--border)] my-0.5" />}
              </span>
              <span className="pb-4 text-sm">
                <b>{e.label}</b> <span className="text-[var(--muted)]">· por {e.actor} · {fmtQuando(e.at)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ações */}
      {advanceError && (
        <p className="mt-3 text-sm font-bold text-[var(--red)] bg-[var(--red-soft)] border border-[var(--border)] rounded-2xl px-4 py-3 anim-pop" role="alert">
          {advanceError}
        </p>
      )}
      <section className="mt-3 flex flex-col sm:flex-row gap-2 anim-rise" style={{ animationDelay: "300ms" }}>
        {next ? (
          <button onClick={() => transition(next)} disabled={busy}
            className="flex-1 bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white font-extrabold rounded-2xl py-3.5 transition-all active:scale-[0.99] disabled:opacity-50">
            {busy ? "Salvando…" : <>Avançar → {STATUS_PT[next]}</>}
          </button>
        ) : (
          order.status !== "cancelled" && (
            <span className="flex-1 text-center bg-[var(--green-soft)] border border-[var(--border)] text-[var(--green)] font-bold rounded-2xl py-3.5 text-sm">
              ✓ Pedido finalizado
            </span>
          )
        )}
        {order.status !== "cancelled" && order.status !== "delivered" && (
          <button onClick={() => setCancelOpen(true)}
            className="flex-1 border-2 border-[var(--border)] text-[var(--red)] font-extrabold rounded-2xl py-3 hover:bg-[var(--red-soft)] transition-colors">
            Cancelar pedido
          </button>
        )}
        <Link href={`/painel/pedidos/${order.id}/print`}
          className="flex-1 text-center border border-[var(--border)] bg-[var(--surface)] font-extrabold rounded-2xl py-3 hover:border-[var(--muted)] transition-colors text-sm self-center">
          🖨 Imprimir 80mm
        </Link>
      </section>

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--text)]/50 backdrop-blur-[2px] p-4" onClick={() => setCancelOpen(false)}>
          <div className="anim-pop w-full max-w-sm bg-[var(--surface)] rounded-3xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-extrabold text-lg">Cancelar #{order.code}?</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">Motivo obrigatório (≥3 letras).</p>
            <input value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(""); }} autoFocus
              placeholder="Ex: sem entregador agora…" maxLength={200}
              className="mt-3 w-full text-sm border rounded-xl px-3.5 py-2.5 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none outline-none" />
            {reasonError && <p className="text-xs font-bold text-[var(--red)] mt-1.5">{reasonError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setCancelOpen(false)} className="flex-1 border border-[var(--border)] font-bold rounded-xl py-3 text-sm hover:bg-[var(--surface-2)] transition-colors">Voltar</button>
              <button onClick={confirmCancel} className="flex-1 bg-[var(--red)] hover:bg-[var(--red)] text-white font-bold rounded-xl py-3 text-sm transition-colors">Cancelar pedido</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
