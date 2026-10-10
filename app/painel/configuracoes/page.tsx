"use client";

import { useState } from "react";
import { NEIGHBORHOODS, brl, getEntry, type Neighborhood } from "../../[slug]/menu-data";

type Tab = "loja" | "horarios" | "entrega";
type Range = { from: string; to: string };
type Day = { open: boolean; ranges: Range[] };
const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const seedDays = (): Day[] =>
  DAYS.map((_, i) => ({
    open: i !== 0,
    ranges: i === 0
      ? []
      : [{ from: "11:00", to: "14:00" }, { from: "18:00", to: "23:00" }],
  }));

export default function Configuracoes() {
  // fase backend: stores via RLS (trigger valida open_hours; active/slug protegidos)
  const entry = getEntry("pizza-do-joao");
  const [tab, setTab] = useState<Tab>("loja");
  const [saved, setSaved] = useState<string | null>(null);

  const [name, setName] = useState(entry?.store.name ?? "");
  const [desc, setDesc] = useState(entry?.store.description ?? "");
  const [zap, setZap] = useState("11999998888");
  const [pix, setPix] = useState("loja@pix.com");
  const [days, setDays] = useState<Day[]>(seedDays);
  const [hoods, setHoods] = useState<Neighborhood[]>(NEIGHBORHOODS);
  const [newHood, setNewHood] = useState("");
  const [newFee, setNewFee] = useState("");
  const [minOrder, setMinOrder] = useState("25,00");
  const [prepMin, setPrepMin] = useState("30");
  const [prepMax, setPrepMax] = useState("45");
  const [errors, setErrors] = useState<string[]>([]);

  const input = "w-full text-sm border rounded-xl px-3.5 py-2.5 bg-stone-50 focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all";
  const label = "text-[13px] font-bold text-stone-700";

  const save = (which: string, errs: string[]) => {
    setErrors(errs);
    setSaved(errs.length === 0 ? which : null);
  };

  const saveLoja = () => {
    const errs: string[] = [];
    if (name.trim().length < 2) errs.push("Nome com pelo menos 2 letras.");
    if (!/^[0-9]{10,15}$/.test(zap.replace(/\D/g, ""))) errs.push("WhatsApp: só dígitos, 10 a 15.");
    save("loja", errs);
  };

  const setRange = (di: number, ri: number, k: keyof Range, v: string) =>
    setDays((ds) => ds.map((d, i) => (i === di
      ? { ...d, ranges: d.ranges.map((r, j) => (j === ri ? { ...r, [k]: v } : r)) }
      : d)));

  const saveHorarios = () => {
    const errs: string[] = [];
    days.forEach((d, i) => {
      if (!d.open) return;
      if (d.ranges.length > 3) errs.push(`${DAYS[i]}: máx 3 faixas/dia.`);
      d.ranges.forEach((r) => {
        if (!/^\d{2}:\d{2}$/.test(r.from) || !/^\d{2}:\d{2}$/.test(r.to)) errs.push(`${DAYS[i]}: horário no formato HH:MM.`);
        else if (r.to <= r.from) errs.push(`${DAYS[i]}: fim (${r.to}) precisa ser maior que início (${r.from}).`);
      });
    });
    save("horarios", errs);
  };

  const saveEntrega = () => {
    const errs: string[] = [];
    if (Number(prepMin) <= 0 || Number(prepMax) < Number(prepMin)) errs.push("Preparo: máx precisa ser ≥ mín.");
    save("entrega", errs);
  };

  const toggleHood = (id: string) =>
    setHoods((hs) => hs.map((h) => (h.id === id ? { ...h, active: !h.active } : h)));
  const removeHood = (id: string) => setHoods((hs) => hs.filter((h) => h.id !== id));
  const addHood = () => {
    const fee = Math.round(Number(newFee.replace(",", ".")) * 100);
    if (newHood.trim().length < 2 || !Number.isFinite(fee) || fee < 0) return;
    setHoods((hs) => [...hs, { id: `b-${Date.now()}`, name: newHood.trim(), fee_cents: fee, active: true }]);
    setNewHood("");
    setNewFee("");
  };
  const activeCount = hoods.filter((h) => h.active).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "loja", label: "Loja" },
    { id: "horarios", label: "Horários" },
    { id: "entrega", label: "Entrega" },
  ];

  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-16">
      <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight anim-rise">Configurações</h1>
      <p className="text-xs text-stone-500 anim-rise">tudo que a vitrine e o checkout obedecem</p>

      {/* abas */}
      <div className="mt-4 inline-flex bg-white border rounded-2xl p-1.5 gap-1 shadow-sm anim-rise" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setSaved(null); setErrors([]); }}
            className={`px-5 sm:px-8 py-2.5 rounded-xl text-sm font-extrabold transition-all ${tab === t.id ? "bg-stone-900 text-white shadow" : "text-stone-500 hover:text-stone-900"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {saved && (
        <p className="mt-3 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 anim-pop">
          ✓ Salvo (demo) — no banco isso atualiza `stores` com RLS do lojista.
        </p>
      )}
      {errors.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm anim-pop" role="alert">
          <ul className="list-disc pl-5 text-red-700 space-y-0.5">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      {tab === "loja" && (
        <section className="mt-3 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
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
              <label className="mt-1 flex items-center gap-3 border-2 border-dashed border-stone-200 hover:border-red-300 rounded-xl px-3 py-2.5 cursor-pointer transition-colors">
                <span className="w-10 h-10 rounded-lg bg-stone-900 text-white flex items-center justify-center font-display font-extrabold shrink-0">PJ</span>
                <span className="text-xs text-stone-500">Trocar logo · WebP ≤1MB<br /><span className="text-stone-400">vai p/ `store-assets/logos`</span></span>
                <input type="file" accept="image/*" className="sr-only" />
              </label>
            </div>
          </div>
          <button onClick={saveLoja} className="mt-4 w-full sm:w-auto bg-stone-900 hover:bg-stone-700 text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99]">
            Salvar loja
          </button>
        </section>
      )}

      {tab === "horarios" && (
        <section className="mt-3 bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
          <p className="text-xs text-stone-400">≤3 faixas por dia · fim sempre maior que início · meia-noite proibida v1</p>
          <ul className="mt-2 divide-y divide-dashed">
            {days.map((d, di) => (
              <li key={DAYS[di]} className="py-3">
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setDays((ds) => ds.map((x, i) => (i === di ? { ...x, open: !x.open } : x)))}
                    role="switch" aria-checked={d.open} aria-label={`${DAYS[di]} aberto`}
                    className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${d.open ? "bg-emerald-500" : "bg-stone-300"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${d.open ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  <b className={`text-sm w-20 ${d.open ? "" : "text-stone-400"}`}>{DAYS[di]}</b>
                  {d.open && d.ranges.length < 3 && (
                    <button onClick={() => setDays((ds) => ds.map((x, i) => (i === di ? { ...x, ranges: [...x.ranges, { from: "18:00", to: "22:00" }] } : x)))}
                      className="ml-auto text-xs font-extrabold text-red-700 hover:underline underline-offset-4">+ faixa</button>
                  )}
                  {!d.open && <span className="text-xs text-stone-400">fechado</span>}
                </div>
                {d.open && (
                  <div className="mt-2 space-y-1.5">
                    {d.ranges.map((r, ri) => (
                      <div key={ri} className="flex items-center gap-2 text-sm">
                        <input type="time" value={r.from} onChange={(e) => setRange(di, ri, "from", e.target.value)}
                          className="border rounded-lg px-2 py-1.5 bg-stone-50 text-sm tabular-nums focus:bg-white focus:border-red-300 outline-none" />
                        <span className="text-stone-400">às</span>
                        <input type="time" value={r.to} onChange={(e) => setRange(di, ri, "to", e.target.value)}
                          className="border rounded-lg px-2 py-1.5 bg-stone-50 text-sm tabular-nums focus:bg-white focus:border-red-300 outline-none" />
                        {d.ranges.length > 1 && (
                          <button onClick={() => setDays((ds) => ds.map((x, i) => (i === di ? { ...x, ranges: x.ranges.filter((_, j) => j !== ri) } : x)))}
                            aria-label="Remover faixa" className="text-stone-300 hover:text-red-600 font-bold transition-colors">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button onClick={saveHorarios} className="mt-4 w-full sm:w-auto bg-stone-900 hover:bg-stone-700 text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99]">
            Salvar horários
          </button>
        </section>
      )}

      {tab === "entrega" && (
        <div className="mt-3 space-y-4">
          <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
            <h2 className="font-display font-extrabold">Bairros e taxas</h2>
            {activeCount === 0 && (
              <p className="mt-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                🚲 0 bairros ativos ⇒ pickup-only: a vitrine esconde Entrega e o checkout recusa entrega (422).
              </p>
            )}
            <ul className="divide-y divide-dashed mt-1">
              {hoods.map((h) => (
                <li key={h.id} className={`flex items-center gap-3 py-2.5 ${h.active ? "" : "opacity-50"}`}>
                  <button onClick={() => toggleHood(h.id)} role="switch" aria-checked={h.active} aria-label={`${h.active ? "Desativar" : "Ativar"} ${h.name}`}
                    className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${h.active ? "bg-emerald-500" : "bg-stone-300"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${h.active ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  <span className="flex-1 text-sm font-bold">{h.name}</span>
                  <span className="text-sm font-extrabold tabular-nums">{brl(h.fee_cents)}</span>
                  <button onClick={() => removeHood(h.id)} aria-label={`Remover ${h.name}`}
                    className="text-stone-300 hover:text-red-600 font-bold transition-colors">✕</button>
                </li>
              ))}
            </ul>
            <div className="border-t border-dashed pt-3 flex gap-2">
              <input value={newHood} onChange={(e) => setNewHood(e.target.value)} placeholder="Novo bairro…"
                className="flex-1 min-w-0 text-sm border rounded-xl px-3 py-2 bg-stone-50 focus:bg-white focus:border-red-300 outline-none" />
              <input value={newFee} onChange={(e) => setNewFee(e.target.value)} placeholder="Taxa R$" inputMode="decimal"
                className="w-24 text-sm border rounded-xl px-3 py-2 bg-stone-50 focus:bg-white focus:border-red-300 outline-none tabular-nums" />
              <button onClick={addHood} className="shrink-0 bg-stone-900 hover:bg-stone-700 text-white text-sm font-extrabold rounded-xl px-4 transition-colors">
                Adicionar
              </button>
            </div>
          </section>

          <section className="bg-white border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
            <h2 className="font-display font-extrabold">Pedido e preparo</h2>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label htmlFor="c-min" className={label}>Pedido mínimo (R$)</label>
                <input id="c-min" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} inputMode="decimal" className={`${input} mt-1 tabular-nums`} />
                <p className="text-[11px] text-stone-400 mt-1">vale sobre o subtotal</p>
              </div>
              <div>
                <label htmlFor="c-pmin" className={label}>Preparo mín (min)</label>
                <input id="c-pmin" value={prepMin} onChange={(e) => setPrepMin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${input} mt-1 tabular-nums`} />
              </div>
              <div>
                <label htmlFor="c-pmax" className={label}>Preparo máx (min)</label>
                <input id="c-pmax" value={prepMax} onChange={(e) => setPrepMax(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${input} mt-1 tabular-nums`} />
                <p className="text-[11px] text-stone-400 mt-1">alimenta o `promised_at`</p>
              </div>
            </div>
            <button onClick={saveEntrega} className="mt-4 w-full sm:w-auto bg-stone-900 hover:bg-stone-700 text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99]">
              Salvar entrega
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
