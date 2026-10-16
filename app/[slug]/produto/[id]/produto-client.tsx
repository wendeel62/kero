"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brl, type Product, type Store } from "../../menu-data";
import { addLine, loadCart, saveCart } from "@/lib/cart";
import { priceOf, validateChoice, type AddonGroup } from "@/lib/addon-groups";

const MAX_QTY = 20; // spec: order_items qty 1..20
const MAX_NOTES = 200; // spec: obs do item ≤200 chars

export default function ProdutoClient({ slug, store, product, categoryName, addonGroups, isOpen, opensAt }: {
  slug: string; store: Store; product: Product; categoryName: string;
  addonGroups: AddonGroup[]; isOpen: boolean; opensAt: string;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [erro, setErro] = useState("");
  const router = useRouter();

  // todos os adicionais aplicáveis, achatados (o preço soma os escolhidos)
  const addons = useMemo(() => addonGroups.flatMap((g) => g.addons), [addonGroups]);
  const addonsTotal = useMemo(() => priceOf(addons, checked), [addons, checked]);
  const total = (product.price_cents + addonsTotal) * qty;
  const canAdd = product.active && isOpen;

  const toggle = (id: string) => {
    setErro("");
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  const adicionar = () => {
    const v = validateChoice(addonGroups, checked);
    if (!v.ok) { setErro(v.error); return; }
    const lines = addLine(loadCart(slug), { productId: product.id, addonIds: checked, notes: notes.trim(), qty });
    saveCart(slug, lines);
    router.push(`/${slug}/carrinho`);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <div className="h-1 bg-[#EA1D2C]" />
      <header className="sticky top-0 z-40 bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href={`/${slug}`} className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-lg transition-colors" aria-label="Voltar ao cardápio">←</Link>
          <span className="font-display font-extrabold tracking-tight">Kero<span className="text-[#EA1D2C]">.</span></span>
          <span className="ml-auto text-xs text-stone-400 font-medium truncate">{store.name}</span>
        </div>
      </header>

      {/* bottom-sheet / split-view */}
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-[480px] sm:max-w-[960px] rounded-t-2xl sm:rounded-2xl max-h-[88vh] sm:max-h-[calc(100vh-3rem)] overflow-y-auto sm:grid sm:grid-cols-[52%_48%] shadow-2xl">
          {/* Foto (lado esquerdo no desktop / em cima no mobile) */}
          <div className="relative h-52 sm:h-auto sm:min-h-[500px] bg-gradient-to-br from-amber-200 via-orange-100 to-rose-200 flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <>
                <span className="absolute left-6 top-5 text-3xl opacity-40 -rotate-12 select-none">🌿</span>
                <span className="absolute right-8 top-8 text-2xl opacity-40 rotate-12 select-none">🧀</span>
                <span className="absolute left-10 bottom-5 text-2xl opacity-30 rotate-6 select-none">🍅</span>
              </>
            )}
            <span className="absolute top-3 left-4 bg-stone-900/85 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">{categoryName}</span>
            <span className="absolute bottom-3 right-4 bg-white text-stone-900 font-extrabold tabular-nums px-3.5 py-1.5 rounded-lg shadow-lg">
              {brl(product.price_cents)}
            </span>
          </div>

          {/* Conteúdo (lado direito no desktop / embaixo no mobile) */}
          <div className="p-4 sm:p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display font-extrabold text-2xl tracking-tight">{product.name}</h1>
              {store.rating != null && (
                <span className="shrink-0 bg-[#FFCE12] text-stone-900 text-[11px] font-extrabold px-2.5 py-1 rounded-lg shadow">★ {store.rating.toLocaleString("pt-BR")}</span>
              )}
            </div>
            <p className="text-sm text-stone-500 mt-1">{product.description}</p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-stone-100">⏱ {store.prep_time_min}–{store.prep_time_max} min</span>
              <span className="px-2.5 py-1 rounded-full bg-stone-100">👥 serve bem 2 pessoas</span>
            </div>
            {!product.active && (
              <div className="mt-3 bg-stone-100 border border-dashed border-stone-300 rounded-lg p-3 text-sm italic text-stone-500">
                Pausado pelo pizzaiolo — volta já. Dá uma olhada no resto do cardápio.
              </div>
            )}
            {!isOpen && product.active && (
              <div className="mt-3 bg-amber-50 border border-dashed border-amber-300 rounded-lg p-3 text-sm">
                Loja fechada — abre às {opensAt}. Você pode montar o pedido, mas sem finalizar.
              </div>
            )}

            {/* Adicionais */}
            <section className="mt-4 border-t border-dashed pt-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#EA1D2C] text-white text-xs font-extrabold">1</span>
                <h2 className="font-display font-extrabold">Adicionais</h2>
                <span className="text-xs text-stone-400">pra deixar do seu jeito</span>
              </div>
              {addonGroups.length === 0 && (
                <p className="py-3 text-sm text-stone-400">Este item não tem adicionais.</p>
              )}
              {addonGroups.map((g) => (
                <div key={g.id ?? "__implicito"}>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-stone-500">{g.name}</span>
                    {g.required && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700">obrigatório</span>}
                    {g.maxChoices !== null && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-stone-100 text-stone-500">máx {g.maxChoices}</span>}
                  </div>
                  <div className="divide-y divide-dashed">
                    {g.addons.map((a) => {
                      const on = checked.includes(a.id);
                      return (
                        <label key={a.id} className={`flex items-center gap-3 py-3 cursor-pointer rounded-lg px-2 -mx-2 transition-colors ${on ? "bg-red-50/60" : ""} ${!canAdd ? "opacity-50" : ""}`}>
                          <input
                            type="checkbox" disabled={!canAdd} checked={on} onChange={() => toggle(a.id)}
                            className="w-5 h-5 rounded accent-[#EA1D2C]"
                          />
                          <span className="flex-1 text-sm font-semibold">{a.name}</span>
                          <span className="text-sm font-bold tabular-nums text-stone-600">+{brl(a.price_cents)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {erro && (
                <p className="mt-3 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                  {erro}
                </p>
              )}
            </section>

            {/* Observações */}
            <section className="mt-4 border-t border-dashed pt-4">
              <div className="flex items-baseline gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#EA1D2C] text-white text-xs font-extrabold">2</span>
                <label htmlFor="obs" className="font-display font-extrabold">Algum recado?</label>
                <span className="ml-auto text-[11px] text-stone-400 tabular-nums">{notes.length}/{MAX_NOTES}</span>
              </div>
              <textarea
                id="obs" rows={2} maxLength={MAX_NOTES} disabled={!canAdd}
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: sem cebola, massa bem assada…"
                className="mt-2 w-full text-sm border rounded-lg p-3 bg-stone-50 focus:bg-white focus:border-[#EA1D2C]/30 focus:ring-2 focus:ring-[#EA1D2C]/10 outline-none transition-all disabled:opacity-50"
              />
            </section>
          </div>

          {/* Footer fixo */}
          <div className="sm:col-span-2 sticky bottom-0 bg-white border-t border-stone-200 p-3 flex items-center gap-3">
            <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
              <button onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={!canAdd || qty <= 1} aria-label="Diminuir"
                className="w-10 h-11 text-lg font-bold hover:bg-stone-100 disabled:opacity-30 transition-colors">−</button>
              <span className="w-8 text-center font-extrabold tabular-nums">{qty}</span>
              <button onClick={() => setQty((n) => Math.min(MAX_QTY, n + 1))} disabled={!canAdd || qty >= MAX_QTY} aria-label="Aumentar"
                className="w-10 h-11 text-lg font-bold hover:bg-stone-100 disabled:opacity-30 transition-colors">+</button>
            </div>
            <button disabled={!canAdd} onClick={adicionar}
              className="flex-1 bg-[#EA1D2C] disabled:bg-stone-300 text-white font-bold rounded-lg py-3.5 px-4 active:scale-[0.99] transition-all">
              {canAdd ? `Adicionar • ${brl(total)}` : product.active ? `Fechada • abre ${opensAt}` : "Indisponível"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}