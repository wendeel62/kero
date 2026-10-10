"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { brl, norm, type Category, type Store } from "./menu-data";
import { addLine, countItems, loadCart, saveCart } from "@/lib/cart";

const PAGE_SIZE = 12; // spec §3.1: 12 itens/categoria + "Ver mais"
// fundos variados p/ o thumb não parecer carimbo repetido de IA
const THUMBS = [
  "from-amber-200 via-orange-100 to-rose-200",
  "from-yellow-100 via-amber-200 to-orange-300",
  "from-rose-100 via-red-100 to-orange-200",
  "from-lime-100 via-amber-100 to-yellow-200",
];

export default function VitrineClient({ store, categories, isOpen, opensAt, minFee }: {
  store: Store; categories: Category[]; isOpen: boolean; opensAt: string; minFee: number | null;
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [cartQty, setCartQty] = useState(0);

  useEffect(() => {
    setCartQty(countItems(loadCart(store.slug)));
  }, [store.slug]);

  const quickAdd = (productId: string) => {
    const lines = addLine(loadCart(store.slug), { productId, addonIds: [], notes: "", qty: 1 });
    saveCart(store.slug, lines);
    setCartQty(countItems(lines));
  };

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return categories
      .map((c) => ({ ...c, products: c.products.filter((p) => !nq || norm(`${p.name} ${p.description}`).includes(nq)) }))
      .filter((c) => c.products.length > 0);
  }, [categories, q]);

  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      {/* faixa topo */}
      <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b shadow-[0_1px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href="/" className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-lg transition-colors" aria-label="Voltar">←</Link>
          <span className="font-display font-extrabold text-lg tracking-tight">Kero<span className="text-red-600">.</span></span>
          <span className="hidden sm:inline text-[11px] text-stone-400 font-medium">delivery do bairro</span>
          <div className="ml-auto flex-1 max-w-xs relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar no cardápio…"
              className="w-full text-sm border rounded-full pl-9 pr-8 py-2 bg-stone-100 border-transparent focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all"
            />
            {q && <button onClick={() => setQ("")} aria-label="Limpar busca" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">✕</button>}
          </div>
        </div>
        {/* letreiro */}
        <div className="bg-stone-900 text-amber-200/90 overflow-hidden whitespace-nowrap text-[12px] font-semibold py-1.5">
          <div className="marquee-track inline-flex gap-8 pr-8">
            {[0, 1].map((k) => (
              <span key={k}>🔥 saindo do forno agora &nbsp;•&nbsp; {minFee !== null ? <>entrega a partir de {brl(minFee)} &nbsp;•&nbsp; </> : null}massa de fermentação lenta &nbsp;•&nbsp; {store.prep_time_min}–{store.prep_time_max} min &nbsp;•&nbsp;</span>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-32">
        {/* hero loja */}
        <section className="mt-4 bg-white border rounded-3xl overflow-hidden shadow-sm">
          <div className="relative h-36 sm:h-44 bg-gradient-to-br from-red-700 via-red-600 to-orange-500 texture-dots texture-grain overflow-hidden">
            <span className="absolute -right-4 -top-8 text-[110px] opacity-30 anim-drift select-none">🍕</span>
            <span className="absolute left-10 bottom-2 text-4xl opacity-25 select-none">🌿</span>
            <span className="absolute left-1/3 top-3 text-2xl opacity-30 select-none">🧀</span>
            <div className="absolute bottom-3 right-4 bg-yellow-300 text-stone-900 text-[11px] font-extrabold px-3 py-1.5 rounded-lg shadow-lg">
              ★ 4.9 · 2,3 mil avaliações
            </div>
          </div>
          <div className="px-4 sm:px-6 pb-4">
            <div className="flex items-end gap-3 -mt-8">
              <div className="w-[72px] h-[72px] rounded-2xl bg-white p-1 shadow-lg ring-1 ring-black/5 anim-pop">
                <div className="w-full h-full rounded-xl bg-stone-900 text-white flex items-center justify-center font-display font-extrabold text-2xl">
                  {store.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
              </div>
              <div className="pb-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-red-600">forno a lenha · desde 2016</p>
                <h1 className="font-display font-extrabold text-[26px] leading-none tracking-tight">{store.name}</h1>
              </div>
            </div>
            <p className="text-sm text-stone-500 mt-1.5 max-w-2xl">{store.description} — a massa descansa 48h antes de ir ao forno.</p>
            <div className="flex flex-wrap gap-2 mt-2.5 text-xs font-semibold">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isOpen ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-green-600 live-dot" : "bg-red-500"}`} />
                {isOpen ? "Aberta agora" : `Fechada • abre às ${opensAt}`}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 transition-colors">⏱ {store.prep_time_min}–{store.prep_time_max} min</span>
              {minFee !== null && (
                <span className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 transition-colors">🛵 entrega a partir de {brl(minFee)}</span>
              )}
              <span className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 transition-colors">mínimo {brl(store.min_order_cents)}</span>
            </div>
            {!isOpen && (
              <div className="mt-3 bg-amber-50 border border-dashed border-amber-300 rounded-xl p-3 text-sm">
                Loja fechada no momento — você pode montar o carrinho, mas o checkout está desabilitado. Abrimos às {opensAt}.
              </div>
            )}
          </div>
        </section>

        {/* categorias — abaixo do cartão da loja */}
        <div className="sticky top-[85px] z-30 -mx-1 px-1 py-2 bg-[#f4f1ec]/95 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((c) => (
              <a key={c.id} href={`#cat-${c.id}`} onClick={() => setActiveCat(c.id)}
                className={`whitespace-nowrap text-[13px] font-bold px-4 py-1.5 rounded-full border transition-all ${activeCat === c.id ? "bg-stone-900 text-white border-stone-900 shadow" : "bg-white text-stone-600 hover:border-stone-400"}`}>
                {c.name}
              </a>
            ))}
          </div>
        </div>

        {/* conteúdo: cardápio + lateral desktop */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <div className="min-w-0 space-y-5">
            {filtered.length === 0 && (
              <div className="text-center py-12 anim-pop bg-white rounded-3xl border">
                <p className="text-5xl">🍽️</p>
                <p className="font-display font-bold mt-2">Nada por aqui…</p>
                <p className="text-sm text-stone-500">Nada encontrado para “{q}”. Vale tentar sem acento — <i>calabresa</i> em vez de <i>calabrêsa</i>.</p>
                <button onClick={() => setQ("")} className="mt-3 text-sm font-bold text-red-600 underline underline-offset-4">limpar busca</button>
              </div>
            )}
            {filtered.map((cat, ci) => {
              const visible = expanded[cat.id] ? cat.products : cat.products.slice(0, PAGE_SIZE);
              return (
                <section key={cat.id} id={`cat-${cat.id}`} className="bg-white rounded-3xl border shadow-sm overflow-hidden scroll-mt-40">
                  <div className="flex items-baseline gap-2 px-4 sm:px-6 pt-4">
                    <h2 className="font-display font-extrabold text-lg tracking-tight">
                      {ci === 0 ? "🔥 " : ""}{cat.name}
                    </h2>
                    <span className="text-xs font-semibold text-stone-400">{cat.products.length} sabores</span>
                    <span className="ml-auto text-[11px] text-stone-300 font-medium hidden sm:inline">receita da casa 👨‍🍳</span>
                  </div>
                  <ul className="px-4 sm:px-6 py-2 sm:grid sm:grid-cols-2 sm:gap-x-6 divide-y divide-dashed sm:divide-y-0">
                    {visible.map((p, pi) => (
                      <li key={p.id} style={{ animationDelay: `${Math.min(pi, 8) * 60}ms` }}
                        className={`anim-rise dish-card flex gap-3 py-3.5 sm:border-b sm:border-dashed sm:border-stone-200 ${!p.active ? "opacity-50 saturate-50" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[15px] leading-tight flex items-center gap-2">
                            {p.name}
                            {ci === 0 && pi === 0 && <span className="bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-sm">MAIS PEDIDA</span>}
                          </p>
                          <p className="text-[13px] text-stone-500 line-clamp-2 mt-0.5">{p.description}</p>
                          <p className="font-extrabold mt-1.5 tabular-nums">{brl(p.price_cents)}</p>
                          {!p.active && <p className="text-xs text-stone-400 italic">pausado pelo pizzaiolo — volta já</p>}
                        </div>
                        <div className="w-24 shrink-0 text-center">
                          <div aria-hidden className={`w-24 h-20 rounded-2xl bg-gradient-to-br ${THUMBS[(pi + ci) % THUMBS.length]} shadow-inner drop-shadow overflow-hidden`} />
                          <button
                            disabled={!p.active || !isOpen}
                            onClick={() => quickAdd(p.id)}
                            aria-label={`Adicionar ${p.name}`}
                            className="mt-1.5 w-full text-sm font-extrabold border rounded-xl py-1.5 text-red-600 border-stone-200 hover:bg-red-600 hover:text-white hover:border-red-600 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-red-600">
                            + adicionar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {cat.products.length > PAGE_SIZE && (
                    <button onClick={() => setExpanded((e) => ({ ...e, [cat.id]: !e[cat.id] }))}
                      className="w-full text-sm font-bold py-3.5 hover:bg-orange-50/60 border-t border-dashed text-red-700 transition-colors">
                      {expanded[cat.id] ? "↑ recolher sabores" : `ver todos os ${cat.products.length} sabores +`}
                    </button>
                  )}
                </section>
              );
            })}

            <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 p-4 text-[13px] text-stone-500 flex gap-3 items-start anim-rise">
              <span className="text-2xl">🛵</span>
              <p><b className="text-stone-700">Da nossa porta pra sua.</b> Pagamento só na entrega ou retirada — dinheiro, Pix na hora ou maquininha. Pedido mínimo de {brl(store.min_order_cents)} no subtotal, sem login, sem enrolação.</p>
            </div>
            <p className="text-center text-[11px] text-stone-400">feito com 🔥 em {store.slug} • kero</p>
          </div>

          {/* lateral desktop */}
          <aside className="hidden lg:block sticky top-[104px] space-y-4">
            <div className="bg-stone-900 text-white rounded-3xl p-5 shadow-lg">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">sua sacola</p>
              <p className="font-display font-extrabold text-3xl mt-1 tabular-nums">{cartQty} {cartQty === 1 ? "item" : "itens"}</p>
              <p className="text-[13px] text-stone-300 mt-1">Falta {brl(store.min_order_cents)} do pedido mínimo — o valor fecha no checkout.</p>
              {isOpen ? (
                <Link href={`/${store.slug}/carrinho`}
                  className="mt-4 block text-center w-full bg-red-600 hover:bg-red-500 font-bold rounded-xl py-3 transition-colors">
                  Ver sacola →
                </Link>
              ) : (
                <button disabled
                  className="mt-4 w-full bg-stone-700 font-bold rounded-xl py-3">
                  {`Fechada • abre ${opensAt}`}
                </button>
              )}
            </div>
            <div className="bg-white rounded-3xl border p-5 text-sm">
              <p className="font-display font-bold">Sobre a loja</p>
              <ul className="mt-2 space-y-1.5 text-stone-500 text-[13px]">
                <li>🕰️ seg–sáb · 11h–14h e 18h–23h</li>
                <li>📍 entrega no centro e jardins</li>
                <li>💳 dinheiro, Pix e maquininha</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {/* barra carrinho — só mobile (desktop usa a lateral) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto">
          {isOpen ? (
            <Link href={`/${store.slug}/carrinho`}
              className="anim-bar w-full bg-gradient-to-r from-red-700 via-red-600 to-red-500 hover:to-orange-500 text-white font-bold rounded-2xl py-4 shadow-[0_12px_30px_-8px_rgba(220,38,38,0.6)] flex items-center justify-between px-5 active:scale-[0.99] transition-all">
              <span className="inline-flex items-center gap-2">
                <span key={cartQty} className="anim-pop inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-full bg-white text-red-700 text-sm font-extrabold">{cartQty}</span>
                <span className="text-sm opacity-90">{cartQty === 1 ? "item na sacola" : "itens na sacola"}</span>
              </span>
              <span>Ver sacola →</span>
            </Link>
          ) : (
            <button disabled
              className="w-full bg-stone-300 text-white font-bold rounded-2xl py-4 flex items-center justify-between px-5">
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-full bg-white text-stone-500 text-sm font-extrabold">{cartQty}</span>
                <span className="text-sm opacity-90">{cartQty === 1 ? "item na sacola" : "itens na sacola"}</span>
              </span>
              <span>{`Fechada • abre ${opensAt}`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
