"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Settings = {
  plan_basico: number;
  plan_completo: number;
  adesao_fee: number;
  ad_spend_daily: number;
};

const FIELDS: Array<{ key: keyof Settings; label: string }> = [
  { key: "plan_basico", label: "Plano Básico R$" },
  { key: "plan_completo", label: "Plano Completo R$" },
  { key: "adesao_fee", label: "Taxa de adesão R$" },
  { key: "ad_spend_daily", label: "Gasto diário em anúncios R$" },
];

export default function AdminSettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/settings");
        if (!r.ok) throw new Error();
        const d = (await r.json()) as { settings: Settings };
        setForm(d.settings);
      } catch {
        setError("Não foi possível carregar as configurações. Tente novamente.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    if (!form || saving) return;
    setSaving(true);
    setError("");
    setOk("");
    try {
      for (const f of FIELDS) {
        const value = Number(form[f.key]);
        if (!Number.isFinite(value) || value < 0)
          throw new Error(`Valor inválido em "${f.label}".`);
        const r = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: f.key, value }),
        });
        if (!r.ok) throw new Error("Falha ao salvar.");
      }
      setOk("Configurações salvas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-16">
        <p className="text-sm text-stone-400 animate-pulse">Carregando configurações…</p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-16">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-stone-500 hover:text-stone-900 transition-colors">
        ← Voltar ao dashboard
      </Link>
      <h1 className="font-display font-extrabold text-[28px] tracking-tight leading-tight mt-2">
        Configurações
      </h1>
      <p className="text-xs text-stone-500 mt-0.5">
        Os valores abaixo espelham no dashboard.
      </p>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-3xl shadow-sm p-4">
          <p className="font-bold text-red-700 text-sm">{error}</p>
        </div>
      )}
      {ok && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-3xl shadow-sm p-4">
          <p className="font-bold text-emerald-700 text-sm">{ok}</p>
        </div>
      )}

      {form && (
        <section className="mt-4 bg-white border rounded-3xl shadow-sm p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-stone-400">
                  {f.label}
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm({ ...form, [f.key]: Number(e.target.value) })
                  }
                  className="mt-1 w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-bold tabular-nums focus:outline-none focus:border-stone-400"
                />
              </label>
            ))}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-extrabold rounded-xl px-5 py-2.5 text-sm transition-colors active:scale-[0.98]"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </section>
      )}
    </main>
  );
}
