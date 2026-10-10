"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ADMIN_STORES, ADMIN_ORDERS, randomPassword } from "../../mock";

export default function LojaDetalhe() {
  const id = useParams().id as string;
  const base = ADMIN_STORES.find((s) => s.id === id);
  const [active, setActive] = useState(base?.active ?? false);
  const [newPass, setNewPass] = useState<string | null>(null);
  const [anonIds, setAnonIds] = useState<string[]>([]);
  const [confirmAnon, setConfirmAnon] = useState<string | null>(null);

  if (!base) notFound();
  // demo: pedidos da loja p/ anonimização (backend: lista por store_id)
  const orders = base.slug === "pizza-do-joao" ? ADMIN_ORDERS : [];
  const validOrders = orders.filter((o) => o.status !== "cancelled");
  const revenue = validOrders.reduce((s, o) => s + o.total_cents, 0);
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const resetPass = () => setNewPass(randomPassword()); // mostra 1 vez

  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-16">
      <Link href="/admin/lojas" className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-stone-500 hover:text-stone-900 transition-colors anim-rise">
        ← Voltar às lojas
      </Link>

      <div className="mt-2 bg-white border rounded-3xl shadow-sm p-5 sm:p-6 anim-rise" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-900 text-white font-display font-extrabold text-xl">
            {base.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-extrabold text-2xl tracking-tight leading-tight truncate">{base.name}</h1>
            <p className="text-xs text-stone-400 font-mono">kero.app/{base.slug} · {base.ownerEmail} · desde {base.createdAt}</p>
          </div>
          <a href={`/${base.slug}`} target="_blank" rel="noreferrer"
            className="shrink-0 text-xs font-extrabold border border-stone-200 hover:border-stone-400 rounded-xl px-3.5 py-2 transition-colors">
            Abrir vitrine ↗
          </a>
        </div>

        {/* números */}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Pedidos hoje", value: String(validOrders.length) },
            { label: "Faturamento", value: brl(revenue) },
            { label: "Slug", value: base.slug },
          ].map((s) => (
            <div key={s.label} className="bg-stone-50 border rounded-2xl px-2 py-2.5">
              <dt className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400">{s.label}</dt>
              <dd className="font-display font-extrabold tabular-nums text-sm mt-0.5 truncate" title={s.value}>{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] text-stone-400">slug imutável · `active` só via service role · dados sensíveis só aqui, nunca na vitrine</p>

        {/* toggle active */}
        <div className={`mt-4 rounded-2xl border-2 p-4 flex items-center gap-3 transition-colors ${active ? "border-emerald-300 bg-emerald-50/50" : "border-red-300 bg-red-50/50"}`}>
          <button onClick={() => setActive((a) => !a)} role="switch" aria-checked={active} aria-label="Loja ativa"
            className={`relative inline-flex w-12 h-7 rounded-full transition-colors shrink-0 ${active ? "bg-emerald-500" : "bg-stone-300"}`}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${active ? "left-6" : "left-1"}`} />
          </button>
          <p className="text-sm">
            <b>{active ? "Loja ativa" : "Loja desativada"}</b>
            {!active && <span className="block text-xs text-stone-500">público recebe 404 (não vaza existência) · painel mostra “desativada pelo operador”</span>}
          </p>
        </div>

        {/* reset senha */}
        <div className="mt-3 border rounded-2xl p-4">
          <p className="font-display font-extrabold text-sm">Acesso do lojista</p>
          <p className="text-xs text-stone-500">{base.ownerEmail} · gera provisória via Auth Admin API, mostra 1 vez</p>
          <button onClick={resetPass} className="mt-2 border border-stone-200 hover:border-stone-400 font-bold rounded-xl px-4 py-2.5 text-sm transition-colors">
            Resetar senha
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
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400 bg-stone-50 border border-dashed rounded-2xl p-4 text-center">Sem pedidos nesta loja.</p>
        ) : (
          <ul className="mt-2 divide-y divide-dashed">
            {orders.map((o) => {
              const done = anonIds.includes(o.id);
              return (
                <li key={o.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-display font-extrabold bg-stone-100 rounded-lg px-2 py-0.5 shrink-0">#{o.code}</span>
                  {done ? (
                    <span className="flex-1 text-stone-400">
                      <b className="text-stone-500">[anonimizado]</b> · <span className="text-xs">anonymized_at agora</span>
                    </span>
                  ) : (
                    <span className="flex-1 min-w-0">
                      <span className="block truncate"><b>{o.customer}</b> · {o.status} · {brl(o.total_cents)}</span>
                      <span className="block text-[11px] text-stone-400">há {o.minutesAgo} min · {o.type === "delivery" ? "entrega" : "retirada"} · {o.payment}</span>
                    </span>
                  )}
                  {!done && (
                    confirmAnon === o.id ? (
                      <span className="flex gap-1.5 shrink-0">
                        <button onClick={() => setConfirmAnon(null)} className="text-xs font-bold border rounded-lg px-2.5 py-1.5 hover:bg-stone-50">voltar</button>
                        <button onClick={() => { setAnonIds((a) => [...a, o.id]); setConfirmAnon(null); }}
                          className="text-xs font-extrabold bg-red-600 hover:bg-red-500 text-white rounded-lg px-2.5 py-1.5 transition-colors">
                          confirmar
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
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
