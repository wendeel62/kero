"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getAdminStats, getLojas, type AdminStoreRow } from "@/lib/admin";

const ADMIN_PER_PAGE = 50; // espelha PER_PAGE da API-04

type Lojas = Awaited<ReturnType<typeof getLojas>>;

export default function Lojas() {
  const [data, setData] = useState<Lojas | null>(null);
  const [stats, setStats] = useState({ stores: 0, active: 0, ordersToday: 0 });
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"basico" | "completo">("basico");
  const [segment, setSegment] = useState("");
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<{ slug: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opError, setOpError] = useState("");
  const [resetting, setResetting] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [adesaoBusy, setAdesaoBusy] = useState<Set<string>>(new Set());

  const fmtAdesao = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null;

  // busca com debounce (a API filtra + pagina no servidor, 50/pág)
  useEffect(() => {
    const t = setTimeout(() => { setTerm(q); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (searchParams.get("open") === "1") {
      setOpen(true);
      setCreated(null);
    }
  }, [searchParams]);

  useEffect(() => {
    getLojas({ page, status: filter, q: term }).then(setData).catch(() => setData(null));
  }, [page, filter, term]);
  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ADMIN_PER_PAGE));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const r = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), slug: slug.trim().toLowerCase(), owner_email: email.trim(),
          plan, ...(segment.trim() ? { segment: segment.trim() } : {}),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setFormError(j?.error?.message ?? "O banco recusou a criação.");
        return;
      }
      setCreated({ slug: j.store.slug, pass: j.password }); // mostra 1 vez — depois some
      setSlug("");
      setName("");
      setEmail("");
      setPlan("basico");
      setSegment("");
      const [d, s] = await Promise.all([
        getLojas({ page: 1, status: filter, q: term }),
        getAdminStats().catch(() => null),
      ]);
      setData(d);
      setPage(1);
      if (s) setStats(s);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const selectAll = () => setSelected(new Set(stores.map((s) => s.id)));
  const clearSelect = () => setSelected(new Set());

  const bulkPatch = async (active: boolean) => {
    const ids = [...selected];
    setBulkBusy(true); setOpError("");
    try {
      await Promise.all(ids.map((id) =>
        fetch(`/api/admin/stores/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message ?? "Falhou ao atualizar.");
        }),
      ));
      setSelected(new Set());
      const d = await getLojas({ page: 1, status: filter, q: term });
      setData(d); setPage(1);
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "Falhou ao atualizar.");
    } finally {
      setBulkBusy(false);
    }
  };

  const resetPass = async (id: string) => {
    setResetting((s) => new Set([...s, id]));
    try {
      const r = await fetch(`/api/admin/stores/${id}/reset-password`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setOpError(j?.error?.message ?? "Falha ao redefinir senha."); return; }
      setRevealed((r) => ({ ...r, [id]: j.password }));
    } finally {
      setResetting((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const markAdesao = async (id: string, paid: boolean) => {
    setAdesaoBusy((s) => new Set([...s, id]));
    try {
      const r = await fetch(`/api/admin/stores/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adesao_paid: paid }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setOpError(j?.error?.message ?? "Falha ao marcar adesão."); return; }
      setData((d) => d ? {
        ...d,
        stores: d.stores.map((s) => s.id === id ? { ...s, adesaoPaidAt: j.store.adesao_paid_at ?? null } : s),
      } : d);
    } finally {
      setAdesaoBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const exportCSV = () => {
    const lines = ["id,nome,slug,email do dono,ativa,criada em,pedidos hoje,plano,segmento,adesao_paga"];
    for (const s of stores) {
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      lines.push([s.id, s.name, s.slug, s.ownerEmail, s.active ? "Sim" : "Não", s.createdAt, s.ordersToday, s.plan, s.segment ?? "", s.adesaoPaidAt ? `Sim ${fmtAdesao(s.adesaoPaidAt)}` : "Não"].map(esc).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lojas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const input = "w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all";
  const stores: AdminStoreRow[] = data?.stores ?? [];

  return (
    <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-16">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-stone-500 hover:text-stone-900 transition-colors anim-rise">
        ← Voltar ao dashboard
      </Link>
      <div className="flex flex-wrap items-end gap-3 anim-rise mt-2">
        <div>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight">Lojas</h1>
          <p className="text-xs text-stone-500 mt-0.5">{data ? `${data.total} lojas · 50 por página` : "carregando…"}</p>
        </div>
        <button onClick={exportCSV} disabled={!data}
          className="border border-stone-200 bg-white font-bold rounded-xl px-4 py-2 text-sm hover:border-stone-400 disabled:opacity-40 transition-colors">
          Exportar CSV
        </button>
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
            <div>
              <label htmlFor="n-plan" className="text-[13px] font-bold text-stone-700">Plano</label>
              <select id="n-plan" value={plan} onChange={(e) => setPlan(e.target.value as "basico" | "completo")}
                className={`${input} mt-1`}>
                <option value="basico">Básico</option>
                <option value="completo">Completo</option>
              </select>
            </div>
            <div>
              <label htmlFor="n-segment" className="text-[13px] font-bold text-stone-700">Segmento</label>
              <input id="n-segment" value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="pizzaria"
                list="segment-suggest" className={`${input} mt-1`} maxLength={40} />
              <datalist id="segment-suggest">
                {["pizzaria", "hamburgueria", "marmita", "açaí", "lanches", "japonesa", "doceria", "saudável"].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <button disabled={saving} className="sm:col-span-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-2xl py-3 transition-colors disabled:opacity-50">
              {saving ? "Criando…" : "Criar loja + gerar senha provisória"}
            </button>
          </form>
          {formError && <p className="mt-2 text-sm font-bold text-red-700" role="alert">{formError}</p>}
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
          { label: "Lojas", value: String(stats.stores) },
          { label: "Ativas", value: String(stats.active) },
          { label: "Pedidos hoje", value: String(stats.ordersToday) },
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
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-[13px] font-extrabold transition-all ${filter === f ? "bg-stone-900 text-white shadow" : "text-stone-500 hover:text-stone-900"}`}>
              {f === "all" ? "Todas" : f === "active" ? "Ativas" : "Inativas"}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por slug ou nome…"
          className="flex-1 min-w-[200px] text-sm border rounded-full px-4 py-2 bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none" />
      </div>
      {stores.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <input type="checkbox" checked={selected.size === stores.length && stores.length > 0} onChange={selectAll}
            className="shrink-0 rounded border-stone-300 text-red-600 focus:ring-red-500" />
          <label className="text-[11px] font-extrabold text-stone-500 select-none">Selecionar todas da página</label>
        </div>
      )}
      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 bg-red-50 border border-red-200 rounded-3xl px-4 py-3">
          <span className="text-sm font-bold text-red-800">{selected.size} selecionada(s)</span>
          <button onClick={() => bulkPatch(true)} disabled={bulkBusy}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-4 py-2 transition-colors disabled:opacity-50">
            {bulkBusy ? "Ativando…" : "Ativar selecionadas"}
          </button>
          <button onClick={() => bulkPatch(false)} disabled={bulkBusy}
            className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl px-4 py-2 transition-colors disabled:opacity-50">
            Desativar selecionadas
          </button>
          <button onClick={clearSelect} className="text-[11px] font-bold text-stone-500 underline hover:text-stone-900">
            Limpar seleção
          </button>
        </div>
      )}
      {opError && (
        <p className="mt-2 text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5" role="alert">{opError}</p>
      )}

      {data === null ? (
        <p className="mt-3 text-sm text-stone-400 animate-pulse">Carregando lojas…</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2.5">
            {stores.map((s, i) => (
              <li key={s.id} style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }} className="anim-rise">
                <Link href={`/admin/lojas/${s.id}`}
                  className={`dish-card bg-white border rounded-3xl shadow-sm p-4 flex items-start gap-3 ${s.active ? "" : "opacity-70"}`}>
                  <span className="shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl bg-stone-900 text-white font-display font-extrabold">
                    {s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm flex-wrap">
                      <b className="truncate">{s.name}</b>
                      <span className={`shrink-0 text-[10px] font-extrabold rounded-full px-2 py-0.5 ${s.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-stone-100 text-stone-500 border border-stone-200"}`}>
                        {s.active ? "ativa" : "inativa → 404 público"}
                      </span>
                      <span className={`shrink-0 text-[10px] font-extrabold rounded-full px-2 py-0.5 ${s.plan === "completo" ? "bg-violet-50 text-violet-700 border border-violet-200" : "bg-sky-50 text-sky-700 border border-sky-200"}`}>
                        {s.plan === "completo" ? "Completo" : "Básico"}
                      </span>
                      {s.segment && (
                        <span className="shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 truncate max-w-[120px]">
                          {s.segment}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-stone-400 font-mono truncate">kero.app/{s.slug} · {s.ownerEmail}</span>
                    {s.adesaoPaidAt ? (
                      <span className="block text-[11px] font-bold text-emerald-700">Adesão paga em {fmtAdesao(s.adesaoPaidAt)}</span>
                    ) : (
                      <span className="block text-[11px] text-stone-400">Adesão pendente</span>
                    )}
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-display font-extrabold tabular-nums">{s.ordersToday}</span>
                    <span className="block text-[11px] text-stone-400">pedidos hoje</span>
                    <span className="block text-[11px] text-stone-300">desde {s.createdAt}</span>
                    <span className="block text-[11px] text-stone-400 mt-1">Último: {s.lastOrderAt ?? "Nenhum pedido"}</span>
                    <div className="mt-2 inline-flex items-center gap-2">
                      <input type="checkbox" checked={selected.has(s.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(s.id); }}
                        aria-label={`Selecionar ${s.name}`}
                        className="shrink-0 rounded border border-stone-300 text-red-600 focus:ring-red-500 bg-stone-50" />
                      {revealed[s.id] ? (
                        <>
                          <code className="text-[11px] bg-stone-900 text-amber-300 font-mono font-bold rounded px-2 py-1 text-center">{revealed[s.id]}</code>
                          <button onClick={() => {
                            navigator.clipboard?.writeText(revealed[s.id]).catch(() => {});
                            setRevealed((r) => { const n = { ...r }; delete n[s.id]; return n; });
                          }}
                            className="shrink-0 text-[11px] font-bold border border-amber-300 text-amber-700 rounded px-2.5 py-1.5 hover:bg-amber-50 transition-colors">
                            Copiar
                          </button>
                        </>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); resetPass(s.id); }} disabled={resetting.has(s.id)}
                          className="shrink-0 text-[11px] font-bold border border-stone-200 text-stone-700 rounded px-2.5 py-1.5 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors">
                          {resetting.has(s.id) ? "…" : "Redefinir senha"}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAdesao(s.id, !s.adesaoPaidAt); }}
                        disabled={adesaoBusy.has(s.id)}
                        className={`shrink-0 text-[11px] font-bold border rounded px-2.5 py-1.5 transition-colors disabled:opacity-50 ${s.adesaoPaidAt ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-stone-200 text-stone-700 hover:bg-emerald-50 hover:border-emerald-300"}`}>
                        {adesaoBusy.has(s.id) ? "…" : s.adesaoPaidAt ? "Desmarcar adesão" : "Marcar adesão paga"}
                      </button>
                    </div>
                  </span>
                  <span className="shrink-0 text-stone-300 font-bold">›</span>
                </Link>
              </li>
            ))}
            {stores.length === 0 && (
              <li className="text-center text-sm text-stone-400 bg-white/60 border border-dashed rounded-3xl p-8">
                Nenhuma loja com “{term}”.
              </li>
            )}
          </ul>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="border border-stone-200 bg-white font-bold rounded-xl px-4 py-2 text-sm hover:border-stone-400 disabled:opacity-40 transition-colors">
                ← Anterior
              </button>
              <span className="text-xs font-bold text-stone-500 tabular-nums">pág {page} de {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="border border-stone-200 bg-white font-bold rounded-xl px-4 py-2 text-sm hover:border-stone-400 disabled:opacity-40 transition-colors">
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
