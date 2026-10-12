"use client";

import { useEffect, useState } from "react";
import { getSettings } from "@/lib/painel";
import type { PanelSettings } from "@/lib/painel-utils";
import { saveEntrega, saveHorarios, saveLoja, saveTables, saveTracking, setCoverUrl, setLogoUrl } from "@/lib/painel-actions";
import { createClient } from "@/lib/supabase/client";
import { parseBRLToCents } from "@/lib/pricing";
import ImageUploader from "@/components/ui/image-uploader";

type Tab = "loja" | "horarios" | "entrega" | "salao" | "rastreamento";
type Range = { from: string; to: string };
type Day = { open: boolean; ranges: Range[] };
type Hood = { id: string; name: string; fee_cents: number; active: boolean };
type Table = { id: string; number: number; label: string; active: boolean };
const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const centsStr = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default function Configuracoes() {
  const [settings, setSettings] = useState<PanelSettings | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("loja");
  const [saved, setSaved] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [zap, setZap] = useState("");
  const [pix, setPix] = useState("");
  const [logoUrl, setLogoUrlState] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const [marquee, setMarquee] = useState("");
  const [coverUrl, setCoverUrlState] = useState<string | null>(null);
  const [coverError, setCoverError] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [hoods, setHoods] = useState<Hood[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [newHood, setNewHood] = useState("");
  const [newFee, setNewFee] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [deletedTableIds, setDeletedTableIds] = useState<string[]>([]);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableLabel, setNewTableLabel] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [prepMin, setPrepMin] = useState("");
  const [prepMax, setPrepMax] = useState("");
  const [fbPixel, setFbPixel] = useState("");
  const [ga4Id, setGa4Id] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(({ settings: s }) => {
      setSettings(s);
      if (!s) return;
      setName(s.name);
      setDesc(s.description);
      setZap(s.whatsapp);
      setPix(s.pix_key);
      setLogoUrlState(s.logo_url);
      setMarquee(s.marquee_text);
      setCoverUrlState(s.cover_url);
      setDays(DAYS.map((_, i) => {
        const ranges = (s.open_hours[String(i)] ?? []).map(([from, to]) => ({ from, to }));
        return ranges.length > 0 ? { open: true, ranges } : { open: false, ranges: [] };
      }));
      setHoods(s.hoods.map((h) => ({ ...h })));
      setTables(s.tables.map((t) => ({ ...t })));
      setMinOrder(centsStr(s.min_order_cents));
      setPrepMin(String(s.prep_time_min ?? ""));
      setPrepMax(String(s.prep_time_max ?? ""));
      setFbPixel(s.fb_pixel_id ?? "");
      setGa4Id(s.ga4_id ?? "");
    }).catch(() => setSettings(null));
  }, []);

  if (settings === undefined) {
    return (
      <main className="admin-content">
        <p className="text-sm text-[var(--muted)] animate-pulse">Carregando configurações…</p>
      </main>
    );
  }
  if (settings === null) {
    return (
      <main className="admin-content">
        <p className="text-sm font-bold text-[var(--red)]">Não foi possível carregar a loja.</p>
      </main>
    );
  }

  const input = "w-full text-sm border rounded-xl px-3.5 py-2.5 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none outline-none transition-all";
  const label = "text-[13px] font-bold text-[var(--text)]";

  const done = (which: string, r: { ok: boolean; error?: string }) => {
    setSaving(false);
    if (r.ok) {
      setErrors([]);
      setSaved(which);
    } else {
      setSaved(null);
      setErrors([r.error ?? "O banco recusou o salvamento."]);
    }
  };

  const saveLojaTab = async () => {
    setSaving(true);
    done("loja", await saveLoja({ name, whatsapp: zap, description: desc, pix_key: pix, marquee_text: marquee }));
  };

  const onLogo = async (blob: Blob) => {
    setLogoError("");
    const sb = createClient();
    const path = `logos/${settings.storeId}/logo.webp`;
    const { error } = await sb.storage.from("store-assets").upload(path, blob, { upsert: true, contentType: "image/webp" });
    if (error) {
      setLogoError("Falha no upload da logo.");
      return;
    }
    const { data } = sb.storage.from("store-assets").getPublicUrl(path);
    const r = await setLogoUrl(`${data.publicUrl}?t=${Date.now()}`);
    if (r.ok) setLogoUrlState(data.publicUrl);
    else setLogoError(r.error ?? "Falha ao salvar a logo.");
  };

  const onCover = async (blob: Blob) => {
    setCoverError("");
    const sb = createClient();
    const path = `logos/${settings.storeId}/cover.webp`;
    const { error } = await sb.storage.from("store-assets").upload(path, blob, { upsert: true, contentType: "image/webp" });
    if (error) {
      setCoverError("Falha no upload da capa.");
      return;
    }
    const { data } = sb.storage.from("store-assets").getPublicUrl(path);
    const r = await setCoverUrl(`${data.publicUrl}?t=${Date.now()}`);
    if (r.ok) setCoverUrlState(data.publicUrl);
    else setCoverError(r.error ?? "Falha ao salvar a capa.");
  };

  const setRange = (di: number, ri: number, k: keyof Range, v: string) =>
    setDays((ds) => ds.map((d, i) => (i === di
      ? { ...d, ranges: d.ranges.map((r, j) => (j === ri ? { ...r, [k]: v } : r)) }
      : d)));

  const saveHorariosTab = async () => {
    setSaving(true);
    const open_hours: Record<string, [string, string][]> = {};
    days.forEach((d, i) => {
      if (d.open && d.ranges.length > 0) open_hours[String(i)] = d.ranges.map((r) => [r.from, r.to]);
    });
    done("horarios", await saveHorarios(open_hours));
  };

  const saveEntregaTab = async () => {
    setSaving(true);
    const min = parseBRLToCents(minOrder);
    const r = await saveEntrega({
      hoods, deletedIds,
      min_order_cents: Number.isInteger(min) ? min : -1,
      prep_time_min: Number(prepMin), prep_time_max: Number(prepMax),
    });
    if (r.ok) {
      // recarrega do banco: troca ids `new-*` pelos reais e limpa remoções,
      // senão um 2º salvar duplica os bairros criados
      const g = await getSettings().catch(() => null);
      if (g?.settings) {
        setHoods(g.settings.hoods.map((h) => ({ ...h })));
        setDeletedIds([]);
      }
    }
    done("entrega", r);
  };

  const toggleHood = (id: string) =>
    setHoods((hs) => hs.map((h) => (h.id === id ? { ...h, active: !h.active } : h)));
  const removeHood = (id: string) => {
    if (!id.startsWith("new-")) setDeletedIds((ds) => [...ds, id]);
    setHoods((hs) => hs.filter((h) => h.id !== id));
  };
  const addHood = () => {
    const fee = parseBRLToCents(newFee);
    if (newHood.trim().length < 2 || !Number.isInteger(fee)) return;
    setHoods((hs) => [...hs, { id: `new-${Date.now()}`, name: newHood.trim(), fee_cents: fee, active: true }]);
    setNewHood("");
    setNewFee("");
  };
  const activeCount = hoods.filter((h) => h.active).length;

  const saveSalaoTab = async () => {
    setSaving(true);
    const r = await saveTables({ tables, deletedIds: deletedTableIds });
    if (r.ok) {
      const g = await getSettings().catch(() => null);
      if (g?.settings) {
        setTables(g.settings.tables.map((t) => ({ ...t })));
        setDeletedTableIds([]);
      }
    }
    done("salao", r);
  };

  const addTable = () => {
    const n = Number(newTableNumber);
    if (!Number.isInteger(n) || n < 1 || n > 999) return;
    setTables((ts) => [...ts, { id: `new-${Date.now()}`, number: n, label: newTableLabel.trim(), active: true }]);
    setNewTableNumber("");
    setNewTableLabel("");
  };
  const removeTable = (id: string) => {
    if (!id.startsWith("new-")) setDeletedTableIds((ds) => [...ds, id]);
    setTables((ts) => ts.filter((t) => t.id !== id));
  };
  const updateTable = (id: string, patch: Partial<Table>) =>
    setTables((ts) => ts.map((t) => {
      if (t.id !== id) return t;
      return { ...t, ...patch };
    }));

  const tabs: { id: Tab; label: string }[] = [
    { id: "loja", label: "Loja" },
    { id: "horarios", label: "Horários" },
    { id: "entrega", label: "Entrega" },
    { id: "salao", label: "Salão" },
    { id: "rastreamento", label: "Rastreamento" },
  ];

  return (
    <main className="admin-content">
      <p className="text-xs text-[var(--muted)] anim-rise">tudo que a vitrine e o checkout obedecem</p>

      {/* abas */}
      <div className="mt-4 inline-flex bg-[var(--surface)] border rounded-2xl p-1.5 gap-1 shadow-sm anim-rise" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setSaved(null); setErrors([]); }}
            className={`px-5 sm:px-8 py-2.5 rounded-xl text-sm font-extrabold transition-all ${tab === t.id ? "bg-[var(--text)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {saved && (
        <p className="mt-3 text-sm font-bold text-[var(--green)] bg-[var(--green-soft)] border border-[var(--border)] rounded-2xl px-4 py-3 anim-pop">
          ✓ Salvo.
        </p>
      )}
      {errors.length > 0 && (
        <div className="mt-3 bg-[var(--red-soft)] border border-[var(--border)] rounded-2xl p-4 text-sm anim-pop" role="alert">
          <ul className="list-disc pl-5 text-[var(--red)] space-y-0.5">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      {tab === "loja" && (
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="c-nome" className={label}>Nome da loja</label>
              <input id="c-nome" value={name} onChange={(e) => setName(e.target.value)} className={`${input} mt-1`} maxLength={80} />
            </div>
            <div>
              <label htmlFor="c-zap" className={label}>WhatsApp (só dígitos)</label>
              <input id="c-zap" value={zap} onChange={(e) => setZap(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${input} mt-1 tabular-nums`} maxLength={15} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="c-desc" className={label}>Descrição</label>
              <textarea id="c-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={200} className={`${input} mt-1`} />
            </div>
            <div>
              <label htmlFor="c-pix" className={label}>Chave Pix</label>
              <input id="c-pix" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, e-mail ou aleatória" className={`${input} mt-1`} />
            </div>
            <div>
              <span className={label}>Logo</span>
              <div className="mt-1 flex items-center gap-3">
                <ImageUploader currentUrl={logoUrl} fallbackEmoji="🏪" onBlob={onLogo} onError={setLogoError} />
                <span className="text-xs text-[var(--muted)]">Trocar logo · WebP ≤1MB<br /><span className="text-[var(--muted)]">vai p/ `store-assets/logos`</span></span>
              </div>
              {logoError && <p className="text-xs font-bold text-[var(--red)] mt-1">{logoError}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="c-marquee" className={label}>Texto do letreiro</label>
              <input id="c-marquee" value={marquee} onChange={(e) => setMarquee(e.target.value)}
                placeholder="Ex: 🔥 saindo do forno agora · entrega grátis" maxLength={120}
                className={`${input} mt-1`} />
              <p className="text-xs text-[var(--muted)] mt-1">Deixe vazio para esconder a barra.</p>
            </div>
            <div>
              <span className={label}>Capa da loja</span>
              <div className="mt-1 flex items-center gap-3">
                <ImageUploader currentUrl={coverUrl} fallbackEmoji="🖼️" onBlob={onCover} onError={setCoverError} />
                <span className="text-xs text-[var(--muted)]">Foto da capa · WebP ≤1MB<br /><span className="text-[var(--muted)]">vai p/ `store-assets/logos`</span></span>
              </div>
              {coverError && <p className="text-xs font-bold text-[var(--red)] mt-1">{coverError}</p>}
            </div>
          </div>
          <button onClick={saveLojaTab} disabled={saving} className="mt-4 w-full sm:w-auto bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99] disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar loja"}
          </button>
        </section>
      )}

      {tab === "horarios" && (
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
          <p className="text-xs text-[var(--muted)]">≤3 faixas por dia · fim sempre maior que início · meia-noite proibida v1</p>
          <ul className="mt-2 divide-y divide-dashed">
            {days.map((d, di) => (
              <li key={DAYS[di]} className="py-3">
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setDays((ds) => ds.map((x, i) => (i === di ? { ...x, open: !x.open } : x)))}
                    role="switch" aria-checked={d.open} aria-label={`${DAYS[di]} aberto`}
                    className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${d.open ? "bg-[var(--green)]" : "bg-[var(--muted)]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] shadow transition-all ${d.open ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  <b className={`text-sm w-20 ${d.open ? "" : "text-[var(--muted)]"}`}>{DAYS[di]}</b>
                  {d.open && d.ranges.length < 3 && (
                    <button onClick={() => setDays((ds) => ds.map((x, i) => (i === di ? { ...x, ranges: [...x.ranges, { from: "18:00", to: "22:00" }] } : x)))}
                      className="ml-auto text-xs font-extrabold text-[var(--red)] hover:underline underline-offset-4">+ faixa</button>
                  )}
                  {!d.open && <span className="text-xs text-[var(--muted)]">fechado</span>}
                </div>
                {d.open && (
                  <div className="mt-2 space-y-1.5">
                    {d.ranges.length === 0 && (
                      <button onClick={() => setDays((ds) => ds.map((x, i) => (i === di ? { ...x, ranges: [{ from: "11:00", to: "14:00" }] } : x)))}
                        className="text-xs font-extrabold text-[var(--red)] hover:underline underline-offset-4">+ primeira faixa</button>
                    )}
                    {d.ranges.map((r, ri) => (
                      <div key={ri} className="flex items-center gap-2 text-sm">
                        <input type="time" value={r.from} onChange={(e) => setRange(di, ri, "from", e.target.value)}
                          className="border rounded-lg px-2 py-1.5 bg-[var(--surface-2)] text-sm tabular-nums focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none" />
                        <span className="text-[var(--muted)]">às</span>
                        <input type="time" value={r.to} onChange={(e) => setRange(di, ri, "to", e.target.value)}
                          className="border rounded-lg px-2 py-1.5 bg-[var(--surface-2)] text-sm tabular-nums focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none" />
                        <button onClick={() => setDays((ds) => ds.map((x, i) => (i === di ? { ...x, ranges: x.ranges.filter((_, j) => j !== ri) } : x)))}
                          aria-label="Remover faixa" className="text-[var(--muted)] hover:text-[var(--red)] font-bold transition-colors">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button onClick={saveHorariosTab} disabled={saving} className="mt-4 w-full sm:w-auto bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99] disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar horários"}
          </button>
        </section>
      )}

      {tab === "entrega" && (
        <div className="mt-3 space-y-4">
          <section className="bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
            <h2 className="font-extrabold">Bairros e taxas</h2>
            {activeCount === 0 && (
              <p className="mt-2 text-xs font-bold text-[var(--amber)] bg-[var(--amber-soft)] border border-[var(--border)] rounded-xl px-3 py-2">
                🚲 0 bairros ativos ⇒ pickup-only: a vitrine esconde Entrega e o checkout recusa entrega (422).
              </p>
            )}
            <ul className="divide-y divide-dashed mt-1">
              {hoods.map((h) => (
                <li key={h.id} className={`flex items-center gap-3 py-2.5 ${h.active ? "" : "opacity-50"}`}>
                  <button onClick={() => toggleHood(h.id)} role="switch" aria-checked={h.active} aria-label={`${h.active ? "Desativar" : "Ativar"} ${h.name}`}
                    className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${h.active ? "bg-[var(--green)]" : "bg-[var(--muted)]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] shadow transition-all ${h.active ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  <span className="flex-1 text-sm font-bold">{h.name}</span>
                  <span className="text-sm font-extrabold tabular-nums">{brl(h.fee_cents)}</span>
                  <button onClick={() => removeHood(h.id)} aria-label={`Remover ${h.name}`}
                    className="text-[var(--muted)] hover:text-[var(--red)] font-bold transition-colors">✕</button>
                </li>
              ))}
            </ul>
            <div className="border-t border-dashed pt-3 flex gap-2">
              <input value={newHood} onChange={(e) => setNewHood(e.target.value)} placeholder="Novo bairro…"
                className="flex-1 min-w-0 text-sm border rounded-xl px-3 py-2 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none" />
              <input value={newFee} onChange={(e) => setNewFee(e.target.value)} placeholder="Taxa R$" inputMode="decimal"
                className="w-24 text-sm border rounded-xl px-3 py-2 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none tabular-nums" />
              <button onClick={addHood} className="shrink-0 bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white text-sm font-extrabold rounded-xl px-4 transition-colors">
                Adicionar
              </button>
            </div>
          </section>

          <section className="bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
            <h2 className="font-extrabold">Pedido e preparo</h2>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label htmlFor="c-min" className={label}>Pedido mínimo (R$)</label>
                <input id="c-min" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} inputMode="decimal" className={`${input} mt-1 tabular-nums`} />
                <p className="text-[11px] text-[var(--muted)] mt-1">vale sobre o subtotal</p>
              </div>
              <div>
                <label htmlFor="c-pmin" className={label}>Preparo mín (min)</label>
                <input id="c-pmin" value={prepMin} onChange={(e) => setPrepMin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${input} mt-1 tabular-nums`} />
              </div>
              <div>
                <label htmlFor="c-pmax" className={label}>Preparo máx (min)</label>
                <input id="c-pmax" value={prepMax} onChange={(e) => setPrepMax(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${input} mt-1 tabular-nums`} />
                <p className="text-[11px] text-[var(--muted)] mt-1">alimenta o `promised_at`</p>
              </div>
            </div>
            <button onClick={saveEntregaTab} disabled={saving} className="mt-4 w-full sm:w-auto bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99] disabled:opacity-50">
              {saving ? "Salvando…" : "Salvar entrega"}
            </button>
          </section>
        </div>
      )}

      {tab === "salao" && (
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
          <h2 className="font-extrabold">Mesas do salão</h2>
          <p className="text-xs text-[var(--muted)] mt-1">Número de 1 a 999. Mesa com pedido ativo não pode ser excluída.</p>
          <ul className="divide-y divide-dashed mt-2">
            {tables.map((t) => {
              const occupied = settings.occupiedTableIds.includes(t.id);
              return (
                <li key={t.id} className={`flex items-center gap-3 py-2.5 ${t.active ? "" : "opacity-50"}`}>
                  <button onClick={() => updateTable(t.id, { active: !t.active })} role="switch" aria-checked={t.active} aria-label={`${t.active ? "Desativar" : "Ativar"} mesa ${t.number}`}
                    className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${t.active ? "bg-[var(--green)]" : "bg-[var(--muted)]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] shadow transition-all ${t.active ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  <span className="w-10 text-sm font-extrabold tabular-nums">{t.number}</span>
                  <input value={t.label} onChange={(e) => updateTable(t.id, { label: e.target.value })} placeholder="Rótulo (opcional)"
                    className="flex-1 min-w-0 text-sm border rounded-xl px-3 py-2 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none" />
                  {occupied && <span className="text-xs font-bold text-[var(--amber)] shrink-0">pedido ativo</span>}
                  <button onClick={() => removeTable(t.id)} disabled={occupied} aria-label={`Remover mesa ${t.number}`}
                    className="text-[var(--muted)] hover:text-[var(--red)] font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed">✕</button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-dashed pt-3 flex gap-2">
            <input value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value.replace(/\D/g, ""))} placeholder="Número" inputMode="numeric"
              className="w-20 text-sm border rounded-xl px-3 py-2 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none tabular-nums" />
            <input value={newTableLabel} onChange={(e) => setNewTableLabel(e.target.value)} placeholder="Rótulo (opcional)"
              className="flex-1 min-w-0 text-sm border rounded-xl px-3 py-2 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none" />
            <button onClick={addTable} className="shrink-0 bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white text-sm font-extrabold rounded-xl px-4 transition-colors">
              Adicionar
            </button>
          </div>
          <button onClick={saveSalaoTab} disabled={saving} className="mt-4 w-full sm:w-auto bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99] disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar mesas"}
          </button>
        </section>
      )}

      {tab === "rastreamento" && (
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
          <h2 className="font-extrabold">Rastreamento</h2>
          <p className="text-xs text-[var(--muted)] mt-1">IDs de Pixel do Facebook e GA4 injetados na vitrine. Deixe vazio para não injetar.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label htmlFor="c-fbpixel" className={label}>Pixel do Facebook</label>
              <input id="c-fbpixel" value={fbPixel} onChange={(e) => setFbPixel(e.target.value)} placeholder="Ex: 1234567890123" inputMode="numeric" className={`${input} mt-1 tabular-nums`} />
              <p className="text-[11px] text-[var(--muted)] mt-1">10 a 20 dígitos</p>
            </div>
            <div>
              <label htmlFor="c-ga4" className={label}>GA4 (Google Analytics)</label>
              <input id="c-ga4" value={ga4Id} onChange={(e) => setGa4Id(e.target.value)} placeholder="Ex: G-ABC123XYZ" className={`${input} mt-1`} />
              <p className="text-[11px] text-[var(--muted)] mt-1">Formato G-XXXXXXXXXX</p>
            </div>
          </div>
          <button onClick={async () => { setSaving(true); done("rastreamento", await saveTracking(fbPixel, ga4Id)); }} disabled={saving} className="mt-4 w-full sm:w-auto bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99] disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar rastreamento"}
          </button>
        </section>
      )}
    </main>
  );
}
