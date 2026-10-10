"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brl, type Addon, type Product, type Store } from "../../menu-data";
import { addLine, loadCart, saveCart } from "@/lib/cart";

const MAX_QTY = 20; // spec: order_items qty 1..20
const MAX_NOTES = 200; // spec: obs do item ≤200 chars

export default function ProdutoClient({ slug, store, product, categoryName, addons, isOpen, opensAt }: {
  slug: string; store: Store; product: Product; categoryName: string;
  addons: Addon[]; isOpen: boolean; opensAt: string;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const router = useRouter();

  const addonsTotal = useMemo(
    () => addons.filter((a) => checked.includes(a.id)).reduce((s, a) => s + a.price_cents, 0),
    [addons, checked]
  );
  const total = (product.price_cents + addonsTotal) * qty;
  const canAdd = product.active && isOpen;

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href={`/${slug}`} className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-lg transition-colors" aria-label="Voltar ao cardápio">←</Link>
          <span className="font-display font-extrabold tracking-tight">Kero<span className="text-red-600">.</span></span>
          <span className="ml-auto text-xs text-stone-400 font-medium truncate">{store.name}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-32">
        <section className="mt-4 bg-white border rounded-3xl overflow-hidden shadow-sm anim-rise">
          <div className="relative h-56 sm:h-72 bg-gradient-to-br from-amber-200 via-orange-100 to-rose-200 texture-dots texture-grain flex items-center justify-center overflow-hidden">
            <span className="absolute left-6 top-5 text-3xl opacity-40 -rotate-12 select-none">🌿</span>
            <span className="absolute right-8 top-8 text-2xl opacity-40 rotate-12 select-none">🧀</span>
            <span className="absolute left-10 bottom-5 text-2xl opacity-30 rotate-6 select-none">🍅</span>
            <span className="text-[128px] drop-shadow-xl anim-drift select-none">{product.image_emoji}</span>
            <span className="absolute top-3 left-4 bg-stone-900/85 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">{categoryName}</span>
            <span className="absolute bottom-3 right-4 bg-white text-stone-900 font-extrabold tabular-nums px-3.5 py-1.5 rounded-xl shadow-lg">
              {brl(product.price_cents)}
            </span>
            {/* ponytail: foto real via Storage WebP quando cardápio tiver upload */}
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display font-extrabold text-2xl tracking-tight">{product.name}</h1>
              <span className="shrink-0 bg-yellow-300 text-stone-900 text-[11px] font-extrabold px-2.5 py-1 rounded-lg shadow">★ 4.9</span>
            </div>
            <p className="text-sm text-stone-500 mt-1">{product.description}</p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-stone-100">⏱ {store.prep_time_min}–{store.prep_time_max} min</span>
              <span className="px-2.5 py-1 rounded-full bg-stone-100">🛵 {brl(store.delivery_fee_cents ?? 0)}</span>
              <span className="px-2.5 py-1 rounded-full bg-stone-100">👥 serve bem 2 pessoas</span>
            </div>
            {!product.active && (
              <div className="mt-3 bg-stone-100 border border-dashed border-stone-300 rounded-xl p-3 text-sm italic text-stone-500">
                Pausado pelo pizzaiolo — volta já. Dá uma olhada no resto do cardápio.
              </div>
            )}
            {!isOpen && product.active && (
              <div className="mt-3 bg-amber-50 border border-dashed border-amber-300 rounded-xl p-3 text-sm">
                Loja fechada — abre às {opensAt}. Você pode montar o pedido, mas sem finalizar.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 bg-white border rounded-3xl shadow-sm overflow-hidden anim-rise" style={{ animationDelay: "80ms" }}>
          <div className="flex items-baseline gap-2 px-4 sm:px-6 pt-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-extrabold">1</span>
            <h2 className="font-display font-extrabold">Adicionais</h2>
            <span className="text-xs text-stone-400">pra deixar do seu jeito</span>
          </div>
          <ul className="divide-y divide-dashed px-4 sm:px-6 pb-2">
            {addons.map((a) => {
              const on = checked.includes(a.id);
              return (
                <li key={a.id}>
                  <label className={`flex items-center gap-3 py-3 cursor-pointer rounded-xl px-2 -mx-2 transition-colors ${on ? "bg-red-50/60" : ""} ${!canAdd ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox" disabled={!canAdd} checked={on} onChange={() => toggle(a.id)}
                      className="w-5 h-5 rounded accent-red-600"
                    />
                    <span className="flex-1 text-sm font-semibold">{a.name}</span>
                    <span className="text-sm font-bold tabular-nums text-stone-600">+{brl(a.price_cents)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-4 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "140ms" }}>
          <div className="flex items-baseline gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-extrabold">2</span>
            <label htmlFor="obs" className="font-display font-extrabold">Algum recado?</label>
            <span className="ml-auto text-[11px] text-stone-400 tabular-nums">{notes.length}/{MAX_NOTES}</span>
          </div>
          <textarea
            id="obs" rows={2} maxLength={MAX_NOTES} disabled={!canAdd}
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: sem cebola, massa bem assada…"
            className="mt-2 w-full text-sm border rounded-xl p-3 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all disabled:opacity-50"
          />
        </section>

      </main>

      {/* barra total fixa */}
      <div className="fixed bottom-0 inset-x-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto bg-white border rounded-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.3)] p-2 pl-3 anim-bar">
          <p className="text-[11px] text-stone-400 font-medium px-1 pb-1.5 tabular-nums">
            {qty} × {brl(product.price_cents + addonsTotal)}{addonsTotal > 0 ? ` (base + adicionais)` : ""} {checked.length > 0 && `· ${checked.length} ${checked.length === 1 ? "adicional" : "adicionais"}`}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-xl overflow-hidden">
              <button onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={!canAdd || qty <= 1} aria-label="Diminuir"
                className="w-10 h-11 text-lg font-bold hover:bg-stone-100 disabled:opacity-30 transition-colors">−</button>
              <span className="w-8 text-center font-extrabold tabular-nums">{qty}</span>
              <button onClick={() => setQty((n) => Math.min(MAX_QTY, n + 1))} disabled={!canAdd || qty >= MAX_QTY} aria-label="Aumentar"
                className="w-10 h-11 text-lg font-bold hover:bg-stone-100 disabled:opacity-30 transition-colors">+</button>
            </div>
            <button disabled={!canAdd} onClick={() => {
              const lines = addLine(loadCart(slug), { productId: product.id, addonIds: checked, notes: notes.trim(), qty });
              saveCart(slug, lines);
              router.push(`/${slug}/carrinho`);
            }}
              className="flex-1 bg-gradient-to-r from-red-700 via-red-600 to-red-500 hover:to-orange-500 disabled:from-stone-300 disabled:to-stone-300 text-white font-bold rounded-xl py-3.5 px-4 active:scale-[0.99] transition-all">
              {canAdd ? `Adicionar • ${brl(total)}` : product.active ? `Fechada • abre ${opensAt}` : "Indisponível"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
