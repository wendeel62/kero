"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/lib/customers";
import type { PanelOrder } from "@/lib/painel-utils";
import { StatusBadge } from "@/components/ui/status-badge";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PROFILE_LABEL: Record<Customer["profile"], string> = { vip: "VIP", recorrente: "Recorrente", novo: "Novo" };
const PROFILE_TINT: Record<Customer["profile"], string> = {
  vip: "bg-[var(--amber-soft)] text-[var(--amber)]",
  recorrente: "bg-[var(--info-soft)] text-[var(--info)]",
  novo: "bg-[var(--pill-bg)] text-[var(--muted)]",
};

const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export default function ClienteDetalhe({ customer, pedidos }: { customer: Customer; pedidos: PanelOrder[] }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push("/painel/clientes"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={() => router.push("/painel/clientes")}>
      <aside
        className="anim-pop w-full sm:w-[420px] h-full bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--pill-active-bg)] text-[var(--pill-active-ink)] text-sm font-extrabold">
            {customer.name[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold truncate">{customer.name}</p>
            <p className="text-xs text-[var(--muted)]">{customer.phone}</p>
          </div>
          <span className={`text-[10px] font-extrabold rounded-full px-2 py-0.5 ${PROFILE_TINT[customer.profile]}`}>{PROFILE_LABEL[customer.profile]}</span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => router.push("/painel/clientes")}
            className="shrink-0 w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
          >✕</button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-xl border border-[var(--border)] p-2.5 text-center">
            <p className="font-extrabold tabular-nums">{customer.orders}</p>
            <p className="text-[10px] text-[var(--muted)]">pedidos</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-2.5 text-center">
            <p className="font-extrabold tabular-nums text-sm">{brl(customer.spentCents)}</p>
            <p className="text-[10px] text-[var(--muted)]">total gasto</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-2.5 text-center">
            <p className="font-extrabold tabular-nums">{daysAgo(customer.lastOrderAt)} d</p>
            <p className="text-[10px] text-[var(--muted)]">último pedido</p>
          </div>
        </div>
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)] mt-4 mb-2">Últimos 10 pedidos</h3>
        <ul className="space-y-2">
          {pedidos.map((o) => (
            <li key={o.id} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm bg-[var(--pill-bg)] rounded-lg px-2 py-0.5">#{o.code}</span>
                <StatusBadge status={o.status} size="sm" />
                <span className="ml-auto font-extrabold tabular-nums text-sm">{brl(o.total_cents)}</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-1.5">
                {o.type === "delivery" ? "Entrega" : "Retirada"} · {o.payment} · há {o.minutesAgo} min
              </p>
            </li>
          ))}
          {pedidos.length === 0 && (
            <li className="text-center text-xs text-[var(--muted)] py-6">sem pedidos válidos</li>
          )}
        </ul>
      </aside>
    </div>
  );
}
