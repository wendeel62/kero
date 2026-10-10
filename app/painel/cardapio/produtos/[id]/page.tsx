"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { GLOBAL_ADDONS, brl, findProduct, getEntry } from "../../../../[slug]/menu-data";

const MAX_PHOTO = 1024 * 1024; // spec: foto WebP ≤1MB

export default function ProdutoFicha() {
  const id = useParams().id as string;
  const isNew = id === "novo";
  const entry = getEntry("pizza-do-joao");
  const found = isNew ? null : findProduct("pizza-do-joao", id);
  const [saved, setSaved] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [name, setName] = useState(found?.product.name ?? "");
  const [desc, setDesc] = useState(found?.product.description ?? "");
  const [price, setPrice] = useState(
    found ? (found.product.price_cents / 100).toFixed(2).replace(".", ",") : ""
  );
  const [catId, setCatId] = useState(found?.product ? entry?.categories.find((c) => c.products.some((p) => p.id === found.product.id))?.id ?? "" : entry?.categories[0]?.id ?? "");
  const [sort, setSort] = useState("0");
  const [active, setActive] = useState(found?.product.active ?? true);
  const [checked, setChecked] = useState<string[]>(["bacon"]);
  const [errors, setErrors] = useState<string[]>([]);

  const cents = useMemo(() => {
    const n = Number(price.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
  }, [price]);

  if (!entry || (!isNew && !found)) notFound();

  const onPhoto = (f: File | undefined) => {
    setPhotoError("");
    if (!f) return;
    if (f.size > MAX_PHOTO) {
      // spec image.ts: rejeita fora do limite (conversão WebP via canvas na fase de upload)
      setPhotoError(`Arquivo de ${(f.size / 1024 / 1024).toFixed(1)} MB — limite 1 MB. Comprima antes de enviar.`);
      setPhotoName("");
      setPhotoUrl(null);
      return;
    }
    setPhotoName(f.name);
    setPhotoUrl(URL.createObjectURL(f));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (name.trim().length < 2) errs.push("Nome com pelo menos 2 letras.");
    if (!Number.isFinite(cents)) errs.push("Preço inválido — use formato 49,90.");
    if (!catId) errs.push("Escolha a categoria.");
    setErrors(errs);
    if (errs.length === 0) setSaved(true);
  };

  const input = "w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all";
  const label = "text-[13px] font-bold text-stone-700";

  return (
    <main className="p-4 sm:p-8 max-w-3xl mx-auto pb-16">
      <Link href="/painel/cardapio" className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-stone-500 hover:text-stone-900 transition-colors anim-rise">
        ← Voltar ao cardápio
      </Link>
      <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight mt-1 anim-rise">
        {isNew ? "Novo produto" : found?.product.name}
      </h1>
      <p className="text-xs text-stone-500 anim-rise">{isNew ? "preencha e salve p/ entrar no cardápio" : `editando · ${found?.categoryName}`}</p>

      {saved ? (
        <div className="mt-4 bg-white border rounded-3xl p-8 text-center anim-pop shadow-sm">
          <p className="text-5xl">✅</p>
          <p className="font-display font-extrabold text-xl mt-2">Salvo (demo)</p>
          <p className="text-sm text-stone-500 mt-1">
            <b>{name || "Produto"}</b> · {Number.isFinite(cents) ? brl(cents) : "—"} · {checked.length} {checked.length === 1 ? "adicional" : "adicionais"} ·
            na fase do banco isso grava `products` (+ `product_addons`) e atualiza a vitrine.
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <button onClick={() => setSaved(false)} className="border border-stone-200 font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-stone-50 transition-colors">
              Continuar editando
            </button>
            <Link href="/painel/cardapio" className="bg-stone-900 text-white font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-stone-700 transition-colors">
              Voltar ao cardápio
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="mt-4 space-y-4">
          {/* foto */}
          <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "60ms" }}>
            <h2 className="font-display font-extrabold">Foto</h2>
            <div className="mt-2 flex items-center gap-4">
              <label className="shrink-0 w-28 h-24 rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 border-2 border-dashed border-stone-300 hover:border-red-400 flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Prévia da foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-center px-2"><span className="block text-2xl">{found?.product.image_emoji ?? "📷"}</span><span className="block text-[11px] font-bold text-stone-500 mt-1">enviar foto</span></span>
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              <div className="text-xs text-stone-500 space-y-1">
                <p>WebP até <b className="text-stone-700">1 MB</b> · largura máx 1200px (conversão automática no envio).</p>
                {photoName && <p className="font-bold text-emerald-600">✓ {photoName}</p>}
                {photoError && <p className="font-bold text-red-600">{photoError}</p>}
              </div>
            </div>
          </section>

          {/* dados */}
          <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "120ms" }}>
            <h2 className="font-display font-extrabold">Dados</h2>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div className="sm:col-span-2">
                <label htmlFor="fnome" className={label}>Nome</label>
                <input id="fnome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Margherita G" maxLength={80} className={`${input} mt-1`} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="fdesc" className={label}>Descrição</label>
                <textarea id="fdesc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Ingredientes, preparo…" maxLength={300} className={`${input} mt-1`} />
              </div>
              <div>
                <label htmlFor="fpreco" className={label}>Preço (R$)</label>
                <input id="fpreco" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49,90" inputMode="decimal" className={`${input} mt-1 tabular-nums`} />
                <p className="text-[11px] text-stone-400 mt-1 tabular-nums">
                  {Number.isFinite(cents) ? `= ${brl(cents)} · ${cents} centavos (int, nunca float)` : "formato 49,90"}
                </p>
              </div>
              <div>
                <label htmlFor="fcat" className={label}>Categoria</label>
                <select id="fcat" value={catId} onChange={(e) => setCatId(e.target.value)} className={`${input} mt-1`}>
                  {entry?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fsort" className={label}>Ordem</label>
                <input id="fsort" value={sort} onChange={(e) => setSort(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${input} mt-1 tabular-nums w-28`} />
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" role="switch" aria-checked={active} onClick={() => setActive((a) => !a)} aria-label="Produto ativo"
                  className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${active ? "bg-emerald-500" : "bg-stone-300"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <span className={`text-sm font-bold ${active ? "text-emerald-600" : "text-stone-400"}`}>{active ? "À venda" : "Pausado"}</span>
              </div>
            </div>
          </section>

          {/* adicionais */}
          <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise" style={{ animationDelay: "180ms" }}>
            <h2 className="font-display font-extrabold">Adicionais</h2>
            <p className="text-xs text-stone-400">marcados entram neste produto · gerenciar todos em <Link href="/painel/cardapio" className="underline text-stone-600">adicionais globais</Link></p>
            <ul className="divide-y divide-dashed mt-1">
              {GLOBAL_ADDONS.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-3 py-2.5 cursor-pointer">
                    <input type="checkbox" checked={checked.includes(a.id)}
                      onChange={() => setChecked((c) => (c.includes(a.id) ? c.filter((x) => x !== a.id) : [...c, a.id]))}
                      className="w-5 h-5 rounded accent-red-600" />
                    <span className="flex-1 text-sm font-semibold">{a.name}</span>
                    <span className="text-sm font-bold tabular-nums text-stone-600">+{brl(a.price_cents)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm anim-pop" role="alert">
              <ul className="list-disc pl-5 text-red-700 space-y-0.5">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-2 anim-rise" style={{ animationDelay: "240ms" }}>
            <button type="submit" className="flex-1 bg-stone-900 hover:bg-stone-700 text-white font-extrabold rounded-2xl py-3.5 transition-all active:scale-[0.99]">
              Salvar produto
            </button>
            {!isNew && (
              <button type="button" onClick={() => alert("Demo: na fase do banco isso desativa o produto (active=false).")}
                className="px-5 border-2 border-red-200 text-red-700 font-extrabold rounded-2xl hover:bg-red-50 transition-colors">
                Excluir
              </button>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
