"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getEntregas } from "@/lib/painel";
import { assignEntrega, criarMotoboy, encerrarRota } from "@/lib/painel-actions";
import type { Courier, MapPoint } from "@/lib/deliveries";
import type { PanelOrder } from "@/lib/painel-utils";

const DeliveryMap = dynamic(() => import("@/components/delivery-map"), { ssr: false });

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type EntregasData = {
  prontas: PanelOrder[];
  emRota: PanelOrder[];
  concluidas: PanelOrder[];
  counts: { prontas: number; emRota: number; concluidas: number };
  couriers: Courier[];
  courierOnRoute: Set<string>;
  routeIdPorCourier: Record<string, string>;
  mapPoints: MapPoint[];
};

export default function Entregas() {
  const [data, setData] = useState<EntregasData | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [novoMotoboy, setNovoMotoboy] = useState(false);
  const [motoboyForm, setMotoboyForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [salvando, setSalvando] = useState(false);

  const load = () => {
    getEntregas().then(setData).catch(() => setData(null));
  };

  useEffect(() => { load(); }, []);

  const doAssign = async (orderId: string, courierId: string) => {
    setError("");
    const r = await assignEntrega(orderId, courierId);
    if (!r.ok) { setError(r.error ?? "Erro ao atribuir."); return; }
    setAssignId(null);
    load();
  };

  if (!data) {
    return (
      <main className="admin-content">
        <p className="text-sm text-[var(--muted)] animate-pulse">Carregando entregas…</p>
      </main>
    );
  }

  const col = (id: string, label: string, orders: PanelOrder[], tint: string, dot: string) => (
    <section className={`anim-rise shrink-0 w-[280px] rounded-[var(--radius-card)] border p-2.5 ${tint}`}>
      <header className="flex items-center gap-2 px-1.5 py-1.5">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</h2>
        <span className="ml-auto text-[11px] font-extrabold tabular-nums text-[var(--muted)] bg-[var(--surface)] rounded-full px-2 py-0.5">{orders.length}</span>
      </header>
      <div className="space-y-2">
        {orders.map((o) => (
          <article key={o.id} className="card p-3.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm bg-[var(--pill-bg)] rounded-lg px-2 py-0.5">#{o.code}</span>
              <span className="text-[11px] font-medium text-[var(--muted)] tabular-nums">há {o.minutesAgo} min</span>
            </div>
            <p className="text-sm font-bold mt-1.5">{o.customer}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className="text-[11px] font-bold bg-[var(--pill-bg)] rounded-full px-2 py-0.5">{o.type === "delivery" ? "Entrega" : "Retirada"}</span>
              <span className="text-[11px] font-bold bg-[var(--pill-bg)] rounded-full px-2 py-0.5">{o.payment}</span>
            </div>
            <p className="font-extrabold tabular-nums mt-1.5">{brl(o.total_cents)}</p>
            {o.status === "out" && (() => {
              const cid = o.courierId;
              const rid = cid ? data.routeIdPorCourier[cid] : undefined;
              return (
                <>
                  <button onClick={() => { setAssignId(o.id); setError(""); }}
                    className="btn btn--primary w-full mt-2.5 !min-h-0 text-[13px] font-extrabold py-2 transition-all active:scale-[0.98]">
                    Atribuir motoboy
                  </button>
                  {rid && (
                    <button onClick={() => { void encerrarRota(rid).then((r) => { if (!r.ok) setError(r.error ?? "Erro ao encerrar rota."); load(); }); }}
                      className="btn btn--ghost w-full mt-1.5 !min-h-0 text-[13px] font-extrabold py-2 transition-all active:scale-[0.98]">
                      Encerrar rota
                    </button>
                  )}
                </>
              );
            })()}
          </article>
        ))}
        {orders.length === 0 && (
          <p className="text-center text-xs text-[var(--muted)] py-6">coluna zerada ✓</p>
        )}
      </div>
    </section>
  );

  return (
    <main className="admin-content">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Entregas</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">Prontas, em rota e concluídas hoje.</p>
        </div>
        <button onClick={() => { setNovoMotoboy(true); setError(""); }}
          className="btn btn--primary !min-h-0 px-4 py-2 text-[13px] font-extrabold shrink-0">
          Novo motoboy
        </button>
      </div>

      {error && <p className="alert-banner anim-pop mt-3" role="alert">{error}</p>}

      {data.mapPoints.length > 0 && (
        <div className="mt-4">
          <DeliveryMap points={data.mapPoints} />
        </div>
      )}

      <div className="mt-5 flex gap-3 overflow-x-auto pb-4 snap-x">
        {col("prontas", "Prontas", data.prontas, "bg-[var(--green-soft)] border-[var(--border)]", "bg-[var(--green)]")}
        {col("emRota", "Em rota", data.emRota, "bg-[var(--amber-soft)] border-[var(--border)]", "bg-[var(--amber)]")}
        {col("concluidas", "Concluídas", data.concluidas, "bg-[var(--pill-bg)] border-[var(--border)]", "bg-[var(--muted)]")}
      </div>

      {assignId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" onClick={() => setAssignId(null)}>
          <div className="anim-pop w-full max-w-sm card p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-extrabold text-lg">Atribuir motoboy</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">Escolha um motoboy ativo.</p>
            <div className="mt-3 space-y-2">
              {data.couriers.length === 0 && (
                <p className="text-sm text-[var(--muted)]">Nenhum motoboy ativo cadastrado.</p>
              )}
              {data.couriers.map((c) => {
                const busy = data.courierOnRoute.has(c.id);
                return (
                  <button key={c.id} disabled={busy} onClick={() => doAssign(assignId, c.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[var(--radius-button)] border text-sm font-bold transition-colors ${busy ? "opacity-40 cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)] hover:border-[var(--red)]"}`}>
                    {c.name} {busy && "· em rota"} {!c.vinculado && <span className="text-[10px] font-bold text-[var(--muted)] ml-1">· sem acesso</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setAssignId(null)} className="btn btn--ghost w-full mt-3 py-3 text-sm">Voltar</button>
          </div>
        </div>
      )}

      {novoMotoboy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" onClick={() => setNovoMotoboy(false)}>
          <div className="anim-pop w-full max-w-sm card p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-extrabold text-lg">Novo motoboy</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">Cadastre um motoboy com acesso ao PWA.</p>
            <div className="mt-3 space-y-2">
              <input value={motoboyForm.name} onChange={(e) => setMotoboyForm({ ...motoboyForm, name: e.target.value })}
                placeholder="Nome completo" className="input w-full" />
              <input value={motoboyForm.phone} onChange={(e) => setMotoboyForm({ ...motoboyForm, phone: e.target.value })}
                placeholder="Telefone" className="input w-full" />
              <input value={motoboyForm.email} onChange={(e) => setMotoboyForm({ ...motoboyForm, email: e.target.value })}
                placeholder="E-mail" type="email" className="input w-full" />
              <input value={motoboyForm.password} onChange={(e) => setMotoboyForm({ ...motoboyForm, password: e.target.value })}
                placeholder="Senha (mín. 8 caracteres)" type="password" className="input w-full" />
            </div>
            <button onClick={() => {
              const f = motoboyForm;
              setMotoboyForm({ name: "", phone: "", email: "", password: "" });
              setNovoMotoboy(false);
              setSalvando(true);
              void criarMotoboy(f).then((r) => {
                setSalvando(false);
                if (!r.ok) { setError(r.error ?? "Erro ao cadastrar."); return; }
                load();
              });
            }} disabled={salvando}
              className="btn btn--primary w-full mt-4 py-3 text-sm font-extrabold disabled:opacity-50">
              {salvando ? "Salvando…" : "Cadastrar motoboy"}
            </button>
            <button onClick={() => setNovoMotoboy(false)} className="btn btn--ghost w-full mt-2 py-3 text-sm">Voltar</button>
          </div>
        </div>
      )}
    </main>
  );
}
