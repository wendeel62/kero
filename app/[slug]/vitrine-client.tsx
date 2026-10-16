"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { brl, norm, type Addon, type Category, type Store } from "./menu-data";
import { addLine, loadCart, loadLastToken, saveCart, type CartLine } from "@/lib/cart";

const PAGE_SIZE = 12; // spec §3.1: 12 itens/categoria + "Ver mais"
// fundos variados p/ o thumb não parecer carimbo repetido de IA
const THUMBS = [
  "from-amber-200 via-orange-100 to-rose-200",
  "from-yellow-100 via-amber-200 to-orange-300",
  "from-rose-100 via-red-100 to-orange-200",
  "from-lime-100 via-amber-100 to-yellow-200",
];
const compact = (n: number) => n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export default function VitrineClient({ store, categories, addons, isOpen, opensAt, minFee }: {
  store: Store; categories: Category[]; addons: Addon[]; isOpen: boolean; opensAt: string; minFee: number | null;
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const hasMarquee = (store.marquee_text ?? "").trim().length > 0;

  useEffect(() => {
    setLines(loadCart(store.slug));
    setLastToken(loadLastToken(store.slug));
  }, [store.slug]);

  const subtotal = useMemo(() => {
    const byId = new Map<string, number>();
    for (const c of categories) for (const p of c.products) byId.set(p.id, p.price_cents);
    const byAddon = new Map(addons.map((a) => [a.id, a.price_cents] as const));
    return lines.reduce((s, l) => {
      const unit = (byId.get(l.productId) ?? 0) + l.addonIds.reduce((a, id) => a + (byAddon.get(id) ?? 0), 0);
      return s + unit * l.qty;
    }, 0);
  }, [lines, categories, addons]);

  const cartQty = lines.reduce((s, l) => s + l.qty, 0);

  const quickAdd = (productId: string) => {
    const next = addLine(lines, { productId, addonIds: [], notes: "", qty: 1 });
    saveCart(store.slug, next);
    setLines(next);
  };

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return categories
      .map((c) => ({ ...c, products: c.products.filter((p) => !nq || norm(`${p.name} ${p.description}`).includes(nq)) }))
      .filter((c) => c.products.length > 0);
  }, [categories, q]);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* faixa topo */}
      <div className="h-1 bg-[#EA1D2C]" />
      <header className="sticky top-0 z-40 bg-white border-b shadow-[0_1px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href="/" className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-lg transition-colors" aria-label="Voltar">←</Link>
          <span className="font-display font-extrabold text-lg tracking-tight">Kero<span className="text-[#EA1D2C]">.</span></span>
          <span className="text-[11px] text-stone-400 font-medium whitespace-nowrap">delivery do bairro</span>
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
        {/* letreiro — texto da loja (C-04); vazio = sem barra */}
        {hasMarquee && (
          <div className="bg-stone-900 text-amber-200/90 overflow-hidden whitespace-nowrap text-[12px] font-semibold py-1.5">
            <div className="marquee-track inline-flex gap-8 pr-8">
              {[0, 1].map((k) => (
                <span key={k}>{store.marquee_text}</span>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-32">
        {/* cover amarelo */}
        <div className="mt-4 h-36 sm:h-44 bg-[#FFCE12] overflow-hidden relative" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(0,0,0,0.08) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
          {store.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.cover_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <span className="absolute -right-4 -top-8 text-[110px] opacity-30 anim-drift select-none">🍕</span>
              <span className="absolute left-10 bottom-2 text-4xl opacity-25 select-none">🌿</span>
              <span className="absolute left-1/3 top-3 text-2xl opacity-30 select-none">🧀</span>
            </>
          )}
        </div>

        {/* store card sobre o cover */}
        <section className="bg-white rounded-xl shadow-sm mx-4 sm:mx-0 -mt-8 relative z-10 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="w-[72px] h-[72px] rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/5 anim-pop overflow-hidden -mt-12 border-2 border-white">
              {store.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logo_url} alt={`Logo ${store.name}`} className="w-full h-full rounded-lg object-cover" />
              ) : (
                <div className="w-full h-full rounded-lg bg-stone-900 text-white flex items-center justify-center font-display font-extrabold text-2xl">
                  {store.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {store.tagline && <p className="text-[11px] font-bold uppercase tracking-widest text-[#EA1D2C]">{store.tagline}</p>}
              <h1 className="font-display font-extrabold text-[26px] leading-none tracking-tight">{store.name}</h1>
            </div>
            {store.rating != null && (
              <span className="w-full sm:w-auto sm:ml-auto bg-[#FFCE12] text-stone-900 text-[11px] font-extrabold px-3 py-1.5 rounded-lg shadow whitespace-nowrap">
                ★ {store.rating.toLocaleString("pt-BR")}
                {store.rating_count != null && ` · ${compact(store.rating_count)} avaliaç${store.rating_count === 1 ? "ão" : "ões"}`}
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 mt-2 max-w-2xl">{store.description}</p>
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
            <div className="mt-3 bg-amber-50 border border-dashed border-amber-300 rounded-lg p-3 text-sm">
              Loja fechada no momento — você pode montar o carrinho, mas o checkout está desabilitado. Abrimos às {opensAt}.
            </div>
          )}
        </section>

        {/* C-08: volta ao acompanhamento do último pedido feito neste aparelho */}
        {lastToken && (
          <Link href={`/${store.slug}/pedido/${lastToken}`}
            className="mt-4 flex items-center justify-between bg-stone-900 text-white rounded-xl px-5 py-3.5 font-bold shadow-lg active:scale-[0.99] transition-all">
            <span className="text-sm">Acompanhar seu pedido</span>
            <span aria-hidden>→</span>
          </Link>
        )}

        {/* categorias — abaixo do cartão da loja */}
        <div className={`sticky ${hasMarquee ? "top-[85px]" : "top-14"} z-30 -mx-1 px-1 py-2 bg-[#F7F7F7]`}>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.filter((c) => c.products.length > 0).map((c) => (
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
              <div className="text-center py-12 anim-pop bg-white rounded-xl border">
                <p className="text-5xl">🍽️</p>
                <p className="font-display font-bold mt-2">Nada por aqui…</p>
                <p className="text-sm text-stone-500">Nada encontrado para “{q}”. Vale tentar sem acento — <i>calabresa</i> em vez de <i>calabrêsa</i>.</p>
                <button onClick={() => setQ("")} className="mt-3 text-sm font-bold text-[#EA1D2C] underline underline-offset-4">limpar busca</button>
              </div>
            )}
            {filtered.map((cat, ci) => {
              const visible = expanded[cat.id] ? cat.products : cat.products.slice(0, PAGE_SIZE);
              return (
                <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-40">
                  <div className="flex items-baseline gap-2 px-1">
                    <h2 className="font-display font-extrabold text-lg tracking-tight">
                      {cat.name}
                    </h2>
                    <span className="text-xs font-semibold text-stone-400">{cat.products.length} {cat.products.length === 1 ? "item" : "itens"}</span>
                  </div>
                  <div className="mt-3 grid sm:grid-cols-2 sm:gap-3">
                    {visible.map((p, pi) => (
                      <div key={p.id}
                        className={`anim-rise dish-card relative flex gap-3 p-3 bg-white rounded-xl mb-2 shadow-sm ${!p.active ? "opacity-50 saturate-50" : ""}`} style={{ animationDelay: `${Math.min(pi, 8) * 60}ms` }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[15px] leading-tight">
                            <Link href={`/${store.slug}/produto/${p.id}`} className="hover:underline underline-offset-4">{p.name}</Link>
                          </p>
                          <p className="text-[13px] text-stone-500 line-clamp-2 mt-0.5">{p.description}</p>
                          <p className="font-extrabold text-[15px] mt-2 tabular-nums">{brl(p.price_cents)}</p>
                          {!p.active && <p className="text-xs text-stone-400 italic">pausado pelo pizzaiolo — volta já</p>}
                        </div>
                        <div className="relative flex-shrink-0">
                          <Link href={`/${store.slug}/produto/${p.id}`} aria-label={`Ver ${p.name}`}
                            className={`dish-thumb block w-[112px] h-[112px] rounded-xl bg-gradient-to-br ${THUMBS[(pi + ci) % THUMBS.length]} shadow-inner overflow-hidden`}>
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                            ) : null}
                          </Link>
                          <button
                            disabled={!p.active || !isOpen}
                            onClick={() => quickAdd(p.id)}
                            aria-label={`Adicionar ${p.name}`}
                            className="absolute -left-3 -bottom-2 w-8 h-8 min-w-8 min-h-8 rounded-full bg-[#EA1D2C] text-white text-lg leading-none shadow flex items-center justify-center active:bg-[#c81623] transition-colors disabled:opacity-30">
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {cat.products.length > PAGE_SIZE && (
                    <button onClick={() => setExpanded((e) => ({ ...e, [cat.id]: !e[cat.id] }))}
                      className="mt-1 w-full text-sm font-bold py-3 rounded-xl bg-white border border-dashed border-stone-300 text-[#EA1D2C] hover:border-[#EA1D2C]/40 transition-colors">
                      {expanded[cat.id] ? "↑ recolher sabores" : `ver todos os ${cat.products.length} sabores +`}
                    </button>
                  )}
                </section>
              );
            })}

          </div>

          {/* lateral desktop */}
          <aside className={`hidden lg:block sticky ${hasMarquee ? "top-[104px]" : "top-[75px]"} space-y-4`}>
            <div className="bg-stone-900 text-white rounded-xl p-5 shadow-lg">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">sua sacola</p>
              <p className="font-display font-extrabold text-3xl mt-1 tabular-nums">{cartQty} {cartQty === 1 ? "item" : "itens"}</p>
              <p className="text-[13px] text-stone-300 mt-1">
                {cartQty > 0 ? <>Sacola: <b className="text-amber-300">{brl(subtotal)}</b> · </> : ""}
                {subtotal >= store.min_order_cents ? "mínimo ✓" : <>faltam {brl(Math.max(0, store.min_order_cents - subtotal))} p/ o mínimo</>}
              </p>
              {isOpen ? (
                <Link href={`/${store.slug}/carrinho`}
                  className="mt-4 block text-center w-full bg-[#EA1D2C] hover:bg-[#c81623] font-bold rounded-lg py-3 transition-colors">
                  Ver sacola →
                </Link>
              ) : (
                <button disabled
                  className="mt-4 w-full bg-stone-700 font-bold rounded-lg py-3">
                  {`Fechada • abre ${opensAt}`}
                </button>
              )}
            </div>
            <div className="bg-white rounded-xl border p-5 text-sm">
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
              className="anim-bar w-full bg-[#EA1D2C] text-white font-bold rounded-t-2xl py-4 shadow-[0_12px_30px_-8px_rgba(220,38,38,0.6)] flex items-center justify-between px-5 active:scale-[0.99] transition-all">
              <span className="text-sm font-extrabold">{cartQty === 1 ? "1 item na sacola" : `${cartQty} itens na sacola`}</span>
              <span className="font-extrabold tabular-nums">{cartQty > 0 ? brl(subtotal) : "ver sacola"}</span>
            </Link>
          ) : (
            <button disabled
              className="w-full bg-stone-300 text-white font-bold rounded-t-2xl py-4 flex items-center justify-between px-5">
              <span className="text-sm font-extrabold">{cartQty === 1 ? "1 item na sacola" : `${cartQty} itens na sacola`}</span>
              <span>{`Fechada • abre ${opensAt}`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
