"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { getLoja } from "@/lib/admin";

type Loja = NonNullable<Awaited<ReturnType<typeof getLoja>>["loja"]>;

export default function LojaDetalhe() {
  const id = useParams().id as string;
  const [loja, setLoja] = useState<Loja | null | undefined>(undefined);
  const [newPass, setNewPass] = useState<string | null>(null);
  const [confirmAnon, setConfirmAnon] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const { loja: l } = await getLoja(id);
    setLoja(l);
  };
  useEffect(() => { reload().catch(() => setLoja(null)); }, [id]);

  if (loja === undefined) {
    return (
      <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-16">
        <p className="text-sm text-stone-400 animate-pulse">Carregando loja…</p>
      </main>
    );
  }
  if (loja === null) notFound();

  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/stores", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: loja.id, ...body }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setError(j?.error?.message ?? "O banco recusou a operação.");
        return null;
      }
      return j;
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    const j = await patch({ active: !loja.active });
    if (j) {
      setLoja({ ...loja, active: j.store.active });
      if (!j.store.active) setError("");
    }
  };

  const resetPass = async () => {
    const j = await patch({ reset_password: true });
    if (j) setNewPass(j.password); // mostra 1 vez
  };

  const anonymize = async (orderId: string) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/orders/${orderId}/anonymize`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setError(j?.error?.message ?? "O banco recusou a anonimização.");
        return;
      }
      setConfirmAnon(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-16">
      <Link href="/admin/lojas" className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-stone-500 hover:text-stone-900 transition-colors anim-rise">
        ← Voltar às lojas
      </Link>

      <div className="mt-2 bg-white border rounded-3xl shadow-sm p-5 sm:p-6 anim-rise" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-900 text-white font-display font-extrabold text-xl">
            {loja.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-extrabold text-2xl tracking-tight leading-tight truncate">{loja.name}</h1>
            <p className="text-xs text-stone-400 font-mono">kero.app/{loja.slug} · {loja.ownerEmail} · desde {loja.createdAt}</p>
          </div>
          <a href={`/${loja.slug}`} target="_blank" rel="noreferrer"
            className="shrink-0 text-xs font-extrabold border border-stone-200 hover:border-stone-400 rounded-xl px-3.5 py-2 transition-colors">
            Abrir vitrine ↗
          </a>
        </div>

        {/* números */}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Pedidos hoje", value: String(loja.stats.orders) },
            { label: "Faturamento", value: brl(loja.stats.revenue) },
            { label: "Slug", value: loja.slug },
          ].map((s) => (
            <div key={s.label} className="bg-stone-50 border rounded-2xl px-2 py-2.5">
              <dt className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400">{s.label}</dt>
              <dd className="font-display font-extrabold tabular-nums text-sm mt-0.5 truncate" title={s.value}>{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] text-stone-400">slug imutável · `active` só via service role · dados sensíveis só aqui, nunca na vitrine</p>

        {error && <p className="mt-3 text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3" role="alert">{error}</p>}

        {/* toggle active */}
        <div className={`mt-4 rounded-2xl border-2 p-4 flex items-center gap-3 transition-colors ${loja.active ? "border-emerald-300 bg-emerald-50/50" : "border-red-300 bg-red-50/50"}`}>
          <button onClick={toggleActive} disabled={busy} role="switch" aria-checked={loja.active} aria-label="Loja ativa"
            className={`relative inline-flex w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${loja.active ? "bg-emerald-500" : "bg-stone-300"}`}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${loja.active ? "left-6" : "left-1"}`} />
          </button>
          <p className="text-sm">
            <b>{loja.active ? "Loja ativa" : "Loja desativada"}</b>
            {!loja.active && <span className="block text-xs text-stone-500">público recebe 404 (não vaza existência) · painel mostra “desativada pelo operador”</span>}
          </p>
        </div>

        {/* reset senha */}
        <div className="mt-3 border rounded-2xl p-4">
          <p className="font-display font-extrabold text-sm">Acesso do lojista</p>
          <p className="text-xs text-stone-500">{loja.ownerEmail} · gera provisória via Auth Admin API, mostra 1 vez</p>
          <button onClick={resetPass} disabled={busy}
            className="mt-2 border border-stone-200 hover:border-stone-400 font-bold rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-50">
            {busy ? "Gerando…" : "Resetar senha"}
          </button>
          {newPass && (
            <div className="mt-2 flex items-center gap-2 anim-pop">
              <code className="flex-1 bg-stone-900 text-amber-300 font-mono font-bold rounded-xl px-4 py-2.5 text-center tracking-widest text-sm">{newPass}</code>
              <button onClick={() => { navigator.clipboard?.writeText(newPass).catch(() => {}); setNewPass(null); }}
                className="shrink-0 bg-amber-100 hover:bg-amber-200 border border-amber-300 font-bold rounded-xl px-4 py-2.5 text-sm transition-colors">
                Copiar e ocultar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* anonimizar (LGPD) */}
      <section className="mt-4 bg-white border rounded-3xl shadow-sm p-5 sm:p-6 anim-rise" style={{ animationDelay: "120ms" }}>
        <h2 className="font-display font-extrabold">Anonimizar pedido <span className="text-xs font-normal text-stone-400">LGPD · retenção &gt;90 dias</span></h2>
        <p className="text-xs text-stone-500 mt-0.5">Apaga nome, telefone, endereço e notas · grava `anonymized_at` · sem volta.</p>
        {loja.orders.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400 bg-stone-50 border border-dashed rounded-2xl p-4 text-center">Sem pedidos nesta loja.</p>
        ) : (
          <ul className="mt-2 divide-y divide-dashed">
            {loja.orders.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center gap-3 text-sm">
                <span className="font-display font-extrabold bg-stone-100 rounded-lg px-2 py-0.5 shrink-0">#{o.code}</span>
                {o.anonymized ? (
                  <span className="flex-1 text-stone-400">
                    <b className="text-stone-500">[anonimizado]</b> · <span className="text-xs">itens/totais/status intactos</span>
                  </span>
                ) : (
                  <span className="flex-1 min-w-0">
                    <span className="block truncate"><b>{o.customer}</b> · {o.status} · {brl(o.total_cents)}</span>
                    <span className="block text-[11px] text-stone-400">há {o.minutesAgo} min · {o.date} · {o.type === "delivery" ? "entrega" : "retirada"} · {o.payment}</span>
                  </span>
                )}
                {!o.anonymized && (
                  confirmAnon === o.id ? (
                    <span className="flex gap-1.5 shrink-0">
                      <button onClick={() => setConfirmAnon(null)} className="text-xs font-bold border rounded-lg px-2.5 py-1.5 hover:bg-stone-50">voltar</button>
                      <button onClick={() => anonymize(o.id)} disabled={busy}
                        className="text-xs font-extrabold bg-red-600 hover:bg-red-500 text-white rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50">
                        #{o.code} sem volta?
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmAnon(o.id)}
                      className="shrink-0 text-xs font-bold text-stone-400 hover:text-red-600 border border-stone-200 hover:border-red-200 rounded-lg px-2.5 py-1.5 transition-colors">
                      Anonimizar
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
