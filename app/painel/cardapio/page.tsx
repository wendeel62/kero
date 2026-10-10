"use client";

import { useState } from "react";
import Link from "next/link";
import { GLOBAL_ADDONS, brl, getEntry, type Addon, type Category } from "../../[slug]/menu-data";

type Cat = Category & { products: (Category["products"][number])[] };

export default function Cardapio() {
  // fase backend: categorias/produtos/addons via RLS (sort_order no banco)
  const entry = getEntry("pizza-do-joao");
  const [cats, setCats] = useState<Cat[]>(entry?.categories.map((c) => ({ ...c, products: [...c.products] })) ?? []);
  const [addons, setAddons] = useState<Addon[]>(GLOBAL_ADDONS);
  const [addonActive, setAddonActive] = useState<Record<string, boolean>>(
    Object.fromEntries(GLOBAL_ADDONS.map((a) => [a.id, true]))
  );
  const [newCat, setNewCat] = useState("");
  const [newAddon, setNewAddon] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const toggleProduct = (catId: string, prodId: string) =>
    setCats((cs) => cs.map((c) => (c.id === catId
      ? { ...c, products: c.products.map((p) => (p.id === prodId ? { ...p, active: !p.active } : p)) }
      : c)));

  const moveCat = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setCats((cs) => {
      const arr = [...cs];
      const from = arr.findIndex((c) => c.id === fromId);
      const to = arr.findIndex((c) => c.id === toId);
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const addCategory = () => {
    const name = newCat.trim();
    if (name.length < 2) return;
    setCats((cs) => [...cs, { id: `cat-${Date.now()}`, name, products: [] }]);
    setNewCat("");
  };

  const addAddon = () => {
    const name = newAddon.trim();
    const cents = Math.round(Number(newAddonPrice.replace(",", ".")) * 100);
    if (name.length < 2 || !Number.isFinite(cents) || cents < 0) return;
    const id = `ad-${Date.now()}`;
    setAddons((as) => [...as, { id, name, price_cents: cents }]);
    setAddonActive((m) => ({ ...m, [id]: true }));
    setNewAddon("");
    setNewAddonPrice("");
  };

  const totalActive = cats.reduce((s, c) => s + c.products.filter((p) => p.active).length, 0);

  return (
    <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-16">
      <div className="flex flex-wrap items-end gap-3 anim-rise">
        <div>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight">Cardápio</h1>
          <p className="text-xs text-stone-500 mt-0.5">{cats.length} categorias · {totalActive} produtos ativos · teto 200/loja</p>
        </div>
        <Link href="/painel/cardapio/produtos/novo"
          className="ml-auto bg-stone-900 hover:bg-stone-700 text-white text-sm font-extrabold rounded-2xl px-5 py-3 transition-all active:scale-[0.98]">
          + Novo produto
        </Link>
      </div>

      {/* categorias (arraste p/ ordenar) */}
      <section className="mt-4 anim-rise" style={{ animationDelay: "60ms" }}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {cats.map((c) => (
            <div key={c.id} draggable
              onDragStart={() => setDragId(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && moveCat(dragId, c.id)}
              onDragEnd={() => setDragId(null)}
              className={`shrink-0 flex items-center gap-2 bg-white border rounded-full pl-2 pr-3 py-1.5 shadow-sm cursor-grab active:cursor-grabbing transition-all ${dragId === c.id ? "opacity-40 scale-95" : "hover:border-stone-400"}`}
              title="Arraste p/ reordenar">
              <span className="text-stone-300 text-xs cursor-grab">⠿</span>
              <a href={`#secao-${c.id}`} className="text-[13px] font-extrabold whitespace-nowrap">{c.name}</a>
              <span className="text-[11px] font-bold tabular-nums text-stone-400 bg-stone-100 rounded-full px-1.5">{c.products.length}</span>
            </div>
          ))}
          <div className="shrink-0 flex items-center gap-1.5 bg-white/60 border border-dashed rounded-full pl-3 pr-1.5 py-1">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="Nova categoria…" maxLength={40}
              className="bg-transparent text-[13px] font-bold placeholder:text-stone-400 outline-none w-32" />
            <button onClick={addCategory} aria-label="Criar categoria"
              className="w-7 h-7 rounded-full bg-stone-900 text-white font-bold hover:bg-stone-700 transition-colors">+</button>
          </div>
        </div>
      </section>

      {/* produtos por categoria */}
      {cats.map((c, ci) => (
        <section key={c.id} id={`secao-${c.id}`} className="mt-5 scroll-mt-8 anim-rise" style={{ animationDelay: `${Math.min(ci, 4) * 60}ms` }}>
          <div className="flex items-baseline gap-2 px-1">
            <h2 className="font-display font-extrabold text-lg tracking-tight">{c.name}</h2>
            <span className="text-xs font-semibold text-stone-400">{c.products.filter((p) => p.active).length}/{c.products.length} ativos</span>
          </div>
          {c.products.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400 bg-white/60 border border-dashed rounded-2xl p-4 text-center">
              Categoria vazia — <Link href="/painel/cardapio/produtos/novo" className="font-bold text-red-700 underline underline-offset-4">criar produto</Link>
            </p>
          ) : (
            <ul className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {c.products.map((p) => (
                <li key={p.id} className={`dish-card bg-white border rounded-3xl shadow-sm p-3 flex flex-col ${!p.active ? "opacity-60 saturate-50" : ""}`}>
                  <span className="w-full h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center text-4xl shadow-inner overflow-hidden">
                    <span className="dish-thumb inline-block">{p.image_emoji}</span>
                  </span>
                  <span className="block font-bold text-sm leading-tight truncate mt-2" title={p.name}>{p.name}</span>
                  <span className="block font-extrabold tabular-nums text-sm mt-0.5">{brl(p.price_cents)}</span>
                  <span className="flex items-center gap-2 mt-2">
                    <button onClick={() => toggleProduct(c.id, p.id)} role="switch" aria-checked={p.active} aria-label={`${p.active ? "Pausar" : "Ativar"} ${p.name}`}
                      className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${p.active ? "bg-emerald-500" : "bg-stone-300"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${p.active ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                    <Link href={`/painel/cardapio/produtos/${p.id}`} className="ml-auto text-xs font-extrabold text-stone-400 hover:text-stone-900 border border-stone-200 hover:border-stone-400 rounded-lg px-2.5 py-1 transition-colors">
                      Editar
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {/* adicionais globais */}
      <section className="mt-6 bg-white border rounded-3xl shadow-sm overflow-hidden anim-rise">
        <div className="px-4 sm:px-6 pt-5">
          <h2 className="font-display font-extrabold text-lg tracking-tight">Adicionais globais</h2>
          <p className="text-[11px] text-stone-400">valem p/ todo o cardápio · os do produto entram na ficha dele</p>
        </div>
        <ul className="divide-y divide-dashed mt-1">
          {addons.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 sm:px-6 py-3">
              <button onClick={() => setAddonActive((m) => ({ ...m, [a.id]: !m[a.id] }))} role="switch" aria-checked={!!addonActive[a.id]}
                aria-label={`${addonActive[a.id] ? "Desativar" : "Ativar"} ${a.name}`}
                className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${addonActive[a.id] ? "bg-emerald-500" : "bg-stone-300"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${addonActive[a.id] ? "left-[18px]" : "left-0.5"}`} />
              </button>
              <span className="flex-1 text-sm font-bold">{a.name}</span>
              <span className="text-sm font-extrabold tabular-nums">+{brl(a.price_cents)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-dashed px-4 sm:px-6 py-3 flex gap-2">
          <input value={newAddon} onChange={(e) => setNewAddon(e.target.value)} placeholder="Novo adicional…"
            className="flex-1 min-w-0 text-sm border rounded-xl px-3 py-2 bg-stone-50 focus:bg-white focus:border-red-300 outline-none" />
          <input value={newAddonPrice} onChange={(e) => setNewAddonPrice(e.target.value)} placeholder="R$" inputMode="decimal"
            className="w-24 text-sm border rounded-xl px-3 py-2 bg-stone-50 focus:bg-white focus:border-red-300 outline-none tabular-nums" />
          <button onClick={addAddon} className="shrink-0 bg-stone-900 hover:bg-stone-700 text-white text-sm font-extrabold rounded-xl px-4 transition-colors">
            Adicionar
          </button>
        </div>
      </section>
    </main>
  );
}
