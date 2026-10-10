"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GLOBAL_ADDONS, brl, type Category, type Product, type Store } from "../menu-data";
import { countItems, loadCart, removeLine, saveCart, setQty, type CartLine } from "@/lib/cart";

type Resolved = { index: number; line: CartLine; product: Product; addonNames: string[]; unit: number };

const STEPS = ["Sacola", "Checkout", "Receber"];

export default function CarrinhoClient({ store, categories, isOpen, opensAt }: {
  store: Store; categories: Category[]; isOpen: boolean; opensAt: string;
}) {
  const [lines, setLines] = useState<CartLine[] | null>(null);

  useEffect(() => {
    const stored = loadCart(store.slug);
    // preview: ?demo=1 enche a sacola com exemplos (só quando vazia)
    if (stored.length === 0 && window.location.search.includes("demo=1")) {
      const demo: CartLine[] = [
        { productId: "marg-g", addonIds: ["bacon"], notes: "sem cebola", qty: 2 },
        { productId: "coca", addonIds: [], notes: "", qty: 1 },
      ];
      saveCart(store.slug, demo);
      setLines(demo);
    } else {
      setLines(stored);
    }
  }, [store.slug]);

  const items = useMemo<Resolved[]>(() => {
    if (!lines) return [];
    const byId = new Map<string, Product>();
    for (const c of categories) for (const p of c.products) byId.set(p.id, p);
    const addonName = new Map(GLOBAL_ADDONS.map((a) => [a.id, a] as const));
    return lines.flatMap((line, index) => {
      const product = byId.get(line.productId);
      if (!product) return []; // saiu do cardápio: ignora a linha
      const addons = line.addonIds.flatMap((id) => {
        const a = addonName.get(id);
        return a ? [a] : [];
      });
      return [{
        index, line, product,
        addonNames: addons.map((a) => a.name),
        unit: product.price_cents + addons.reduce((s, a) => s + a.price_cents, 0),
      }];
    });
  }, [lines, categories]);

  const subtotal = items.reduce((s, i) => s + i.unit * i.line.qty, 0);
  const reachedMin = subtotal >= store.min_order_cents;
  const canGo = items.length > 0 && reachedMin && isOpen;
  const ctaLabel = items.length === 0 ? "Sacola vazia" : !reachedMin ? "Abaixo do mínimo" : !isOpen ? `Fechada • abre ${opensAt}` : "Ir p/ o checkout →";

  const update = (next: CartLine[]) => {
    saveCart(store.slug, next);
    setLines(next);
  };

  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b shadow-[0_1px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href={`/${store.slug}`} className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-lg transition-colors" aria-label="Voltar ao cardápio">←</Link>
          <span className="font-display font-extrabold tracking-tight">Kero<span className="text-red-600">.</span></span>
          {lines && lines.length > 0 && (
            <button onClick={() => update([])} className="ml-auto text-xs font-bold text-stone-400 hover:text-red-600 underline underline-offset-4">
              limpar tudo
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-40 lg:pb-16">
        {/* stepper de etapas */}
        <ol className="flex items-center gap-1.5 mt-5 anim-rise" aria-label="Etapas do pedido">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
              <span className={`flex items-center gap-2 text-[12px] font-extrabold whitespace-nowrap ${i === 0 ? "text-stone-900" : "text-stone-400"}`}>
                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${i === 0 ? "bg-stone-900 text-white shadow" : "bg-white border text-stone-400"}`}>
                  {i + 1}
                </span>
                {s}
              </span>
              {i < STEPS.length - 1 && <span className="flex-1 h-px bg-stone-300 mx-1" />}
            </li>
          ))}
        </ol>

        {/* faixa da loja */}
        <div className="mt-3 bg-white border rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3 anim-rise" style={{ animationDelay: "60ms" }}>
          <div className="w-11 h-11 rounded-xl bg-stone-900 text-white flex items-center justify-center font-display font-extrabold ring-1 ring-black/5">
            {store.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0">
            <p className="font-display font-extrabold leading-tight truncate">{store.name}</p>
            <p className="text-xs text-stone-500">★ 4.9 · ⏱ {store.prep_time_min}–{store.prep_time_max} min · 🛵 {brl(store.delivery_fee_cents ?? 0)}</p>
          </div>
          <Link href={`/${store.slug}`} className="ml-auto shrink-0 text-xs font-extrabold text-red-700 border border-stone-200 rounded-full px-3.5 py-1.5 hover:bg-red-50 transition-colors">
            cardápio
          </Link>
        </div>

        {lines === null ? (
          <div className="mt-4 bg-white border rounded-3xl p-10 text-center text-sm text-stone-400">carregando sacola…</div>
        ) : items.length === 0 ? (
          <div className="mt-4 bg-white border rounded-3xl p-10 sm:p-14 text-center anim-pop shadow-sm overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />
            <p className="text-7xl anim-drift inline-block">🛒</p>
            <p className="font-display font-extrabold text-2xl mt-3 tracking-tight">Sacola vazia</p>
            <p className="text-sm text-stone-500 mt-1">Que tal começar por uma Margherita quentinha?</p>
            <Link href={`/${store.slug}`} className="btn-shine inline-block mt-5 bg-gradient-to-r from-red-700 to-red-500 text-white font-bold rounded-xl px-8 py-3.5 shadow-lg">
              Ver cardápio
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest text-stone-400 px-1 mb-2">
                {countItems(lines)} {countItems(lines) === 1 ? "item" : "itens"}
              </p>
              <ul className="space-y-3">
                {items.map(({ index, line, product, addonNames, unit }, i) => (
                  <li key={`${line.productId}-${index}`} style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                    className="anim-rise dish-card bg-white border rounded-3xl shadow-sm p-4 flex gap-3.5">
                    <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center text-4xl shrink-0 shadow-inner ring-1 ring-black/5 overflow-hidden">
                      <span className="dish-thumb inline-block drop-shadow">{product.image_emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="font-bold text-[15px] leading-snug flex-1">{product.name}</p>
                        <button onClick={() => update(removeLine(lines, index))} aria-label={`Remover ${product.name}`}
                          className="w-7 h-7 rounded-full hover:bg-red-50 text-stone-300 hover:text-red-600 text-base leading-none transition-colors">✕</button>
                      </div>
                      {addonNames.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {addonNames.map((n) => (
                            <span key={n} className="text-[11px] font-bold bg-orange-50 text-orange-800 border border-orange-200/70 rounded-full px-2 py-0.5">+ {n}</span>
                          ))}
                        </div>
                      )}
                      {line.notes && <p className="text-xs text-stone-400 italic mt-1">“{line.notes}”</p>}
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-center bg-stone-100 rounded-full p-0.5">
                          <button onClick={() => update(setQty(lines, index, line.qty - 1))} aria-label="Diminuir"
                            className="w-8 h-8 rounded-full font-bold hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all">−</button>
                          <span className="w-7 text-center text-sm font-extrabold tabular-nums">{line.qty}</span>
                          <button onClick={() => update(setQty(lines, index, line.qty + 1))} aria-label="Aumentar"
                            className="w-8 h-8 rounded-full font-bold hover:bg-white hover:shadow-sm transition-all">+</button>
                        </div>
                        <p className="font-display font-extrabold tabular-nums">{brl(unit * line.qty)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Link href={`/${store.slug}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-red-700 hover:underline underline-offset-4 px-1">
                + adicionar mais itens
              </Link>
            </div>

            {/* recibo */}
            <div className="bg-stone-900 text-white rounded-3xl shadow-[0_20px_50px_-16px_rgba(28,25,23,0.55)] p-6 lg:sticky lg:top-20 h-fit texture-dots">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-300">resumo do pedido</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between text-stone-300">
                  <dt>Subtotal</dt>
                  <dd className="font-bold tabular-nums text-white">{brl(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-stone-300">
                  <dt>Entrega</dt>
                  <dd className="text-xs self-center text-stone-400">bairro no checkout</dd>
                </div>
              </dl>
              <div className="receipt-div mt-4 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-stone-300">Total estimado</span>
                  <span className="font-display font-extrabold text-3xl tabular-nums">{brl(subtotal)}</span>
                </div>
              </div>
              {!reachedMin ? (
                <div className="mt-4">
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400 transition-all"
                      style={{ width: `${Math.min(100, (subtotal / store.min_order_cents) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-stone-300 mt-2">
                    Faltam <b className="text-white">{brl(store.min_order_cents - subtotal)}</b> p/ o mínimo de {brl(store.min_order_cents)}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-xs font-bold text-emerald-300 bg-emerald-400/10 border border-emerald-300/25 rounded-xl px-3 py-2">
                  ✓ Pedido mínimo ok — bora fechar?
                </p>
              )}
              {!isOpen && (
                <p className="mt-3 text-xs text-amber-200 bg-amber-300/10 border border-dashed border-amber-300/40 rounded-xl px-3 py-2">
                  Loja fechada — abre às {opensAt}. Checkout desabilitado.
                </p>
              )}
              <div className="hidden lg:block mt-4">
                {canGo ? (
                  <Link href={`/${store.slug}/checkout`}
                    className="btn-shine block text-center w-full bg-gradient-to-r from-red-600 to-orange-500 font-bold rounded-xl py-3.5 shadow-lg transition-transform active:scale-[0.99]">
                    Ir p/ o checkout →
                  </Link>
                ) : (
                  <button disabled className="w-full bg-white/10 text-stone-400 font-bold rounded-xl py-3.5">{ctaLabel}</button>
                )}
              </div>
              <p className="mt-3 text-center text-[11px] text-stone-500">💵 dinheiro · ⚡Pix · 💳 maquininha — só na entrega</p>
            </div>
          </div>
        )}

        {/* barra fixa mobile */}
        {items.length > 0 && (
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="max-w-3xl mx-auto bg-white border rounded-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.3)] p-2 anim-bar">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="text-xs text-stone-500 font-medium">Subtotal · {countItems(lines ?? [])} {countItems(lines ?? []) === 1 ? "item" : "itens"}</span>
                <span className="font-display font-extrabold tabular-nums">{brl(subtotal)}</span>
              </div>
              {canGo ? (
                <Link href={`/${store.slug}/checkout`}
                  className="btn-shine block text-center w-full bg-gradient-to-r from-red-700 via-red-600 to-red-500 text-white font-bold rounded-xl py-3.5">
                  Ir p/ o checkout →
                </Link>
              ) : (
                <button disabled className="w-full bg-stone-200 text-stone-400 font-bold rounded-xl py-3.5">{ctaLabel}</button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
