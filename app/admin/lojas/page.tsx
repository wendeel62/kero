"use client";

import { useState } from "react";
import Link from "next/link";
import { ADMIN_STORES, randomPassword } from "../mock";

export default function Lojas() {
  // fase backend: lista paginada (50/pág) via service role + create via Auth Admin API
  const [stores, setStores] = useState(ADMIN_STORES);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<{ slug: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = stores.filter((s) =>
    (filter === "all" || (filter === "active") === s.active) &&
    `${s.slug} ${s.name}`.toLowerCase().includes(q.trim().toLowerCase())
  );
  const totalOrders = stores.reduce((s, x) => s + x.ordersToday, 0);
  const activeCount = stores.filter((s) => s.active).length;

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,40}$/.test(clean) || name.trim().length < 2 || !/.+@.+\..+/.test(email)) return;
    const pass = randomPassword();
    setStores((ss) => [...ss, {
      id: `s-${Date.now()}`, slug: clean, name: name.trim(), ownerEmail: email.trim(),
      active: false, ordersToday: 0, createdAt: new Date().toLocaleDateString("pt-BR"),
    }]);
    setCreated({ slug: clean, pass }); // mostra 1 vez — depois some
    setSlug("");
    setName("");
    setEmail("");
  };

  const input = "w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all";

  return (
    <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-16">
      <div className="flex flex-wrap items-end gap-3 anim-rise">
        <div>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight">Lojas</h1>
          <p className="text-xs text-stone-500 mt-0.5">{stores.length} lojas · 50 por página</p>
        </div>
        <button onClick={() => { setOpen((o) => !o); setCreated(null); }}
          className="ml-auto bg-stone-900 hover:bg-stone-700 text-white text-sm font-extrabold rounded-2xl px-5 py-3 transition-all active:scale-[0.98]">
          {open ? "Fechar" : "+ Nova loja"}
        </button>
      </div>

      {open && (
        <section className="mt-4 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-pop">
          <h2 className="font-display font-extrabold">Criar loja</h2>
          <p className="text-xs text-stone-400">slug é imutável — confira antes de salvar</p>
          <form onSubmit={create} className="grid sm:grid-cols-3 gap-3 mt-3">
            <div>
              <label htmlFor="n-slug" className="text-[13px] font-bold text-stone-700">Slug</label>
              <input id="n-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="pizza-do-joao"
                className={`${input} mt-1 font-mono`} maxLength={40} />
            </div>
            <div>
              <label htmlFor="n-nome" className="text-[13px] font-bold text-stone-700">Nome</label>
              <input id="n-nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pizza do João"
                className={`${input} mt-1`} maxLength={80} />
            </div>
            <div>
              <label htmlFor="n-email" className="text-[13px] font-bold text-stone-700">E-mail do dono</label>
              <input id="n-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dono@loja.com"
                type="email" className={`${input} mt-1`} />
            </div>
            <button className="sm:col-span-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-2xl py-3 transition-colors">
              Criar loja + gerar senha provisória
            </button>
          </form>
          {created && (
            <div className="mt-3 bg-amber-50 border border-amber-300 rounded-2xl p-4 anim-pop">
              <p className="text-sm font-extrabold">🔑 Senha provisória de <span className="font-mono">{created.slug}</span> — aparece 1 vez:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 bg-stone-900 text-amber-300 font-mono font-bold rounded-xl px-4 py-3 text-center tracking-widest">{created.pass}</code>
                <button onClick={() => { navigator.clipboard?.writeText(created.pass).catch(() => {}); setCopied(true); }}
                  className="shrink-0 border border-amber-300 font-bold rounded-xl px-4 py-3 text-sm hover:bg-amber-100 transition-colors">
                  {copied ? "✓ copiada" : "Copiar"}
                </button>
              </div>
              <p className="text-xs text-stone-500 mt-2">Entregue por fora ao lojista · ele troca em “Esqueci minha senha”. Fechando este painel, ela some.</p>
            </div>
          )}
        </section>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 anim-rise" style={{ animationDelay: "60ms" }}>
        {[
          { label: "Lojas", value: String(stores.length) },
          { label: "Ativas", value: String(activeCount) },
          { label: "Pedidos hoje", value: String(totalOrders) },
        ].map((c) => (
          <div key={c.label} className="bg-white border rounded-3xl shadow-sm px-4 py-3.5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-400">{c.label}</p>
            <p className="font-display font-extrabold text-2xl tabular-nums tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 anim-rise" style={{ animationDelay: "100ms" }}>
        <div className="inline-flex bg-white border rounded-full p-1 gap-0.5">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-extrabold transition-all ${filter === f ? "bg-stone-900 text-white shadow" : "text-stone-500 hover:text-stone-900"}`}>
              {f === "all" ? "Todas" : f === "active" ? "Ativas" : "Inativas"}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por slug ou nome…"
          className="flex-1 min-w-[200px] text-sm border rounded-full px-4 py-2 bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none" />
      </div>

      <ul className="mt-3 space-y-2.5">
        {filtered.map((s, i) => (
          <li key={s.id} style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }} className="anim-rise">
            <Link href={`/admin/lojas/${s.id}`}
              className={`dish-card bg-white border rounded-3xl shadow-sm p-4 flex items-center gap-3 ${s.active ? "" : "opacity-70"}`}>
              <span className="shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl bg-stone-900 text-white font-display font-extrabold">
                {s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm">
                  <b className="truncate">{s.name}</b>
                  <span className={`shrink-0 text-[10px] font-extrabold rounded-full px-2 py-0.5 ${s.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-stone-100 text-stone-500 border border-stone-200"}`}>
                    {s.active ? "ativa" : "inativa → 404 público"}
                  </span>
                </span>
                <span className="block text-xs text-stone-400 font-mono truncate">kero.app/{s.slug} · {s.ownerEmail}</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block font-display font-extrabold tabular-nums">{s.ordersToday}</span>
                <span className="block text-[11px] text-stone-400">pedidos hoje</span>
                <span className="block text-[11px] text-stone-300">desde {s.createdAt}</span>
              </span>
              <span className="shrink-0 text-stone-300 font-bold">›</span>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-center text-sm text-stone-400 bg-white/60 border border-dashed rounded-3xl p-8">
            Nenhuma loja com “{q}”.
          </li>
        )}
      </ul>
    </main>
  );
}
