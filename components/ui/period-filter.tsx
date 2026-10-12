"use client";

// Filtro de período compartilhado (as 3 telas: Hoje, Kanban, Relatórios).
// O período "Personalizado" abre dois campos de data; o intervalo só é aplicado
// quando as duas datas existem e fazem sentido — sem isso o helper cairia em 7d
// e a tela mostraria uma janela diferente da que o lojista pediu.
import { useEffect, useState } from "react";
import { PERIOD_KINDS, PERIOD_LABEL, type CustomRange, type PeriodKind } from "@/lib/period";

export default function PeriodFilter({
  period, range, onPeriod, onRange, size = "md",
}: {
  period: PeriodKind;
  range: CustomRange;
  onPeriod: (k: PeriodKind) => void;
  onRange: (r: CustomRange) => void;
  size?: "sm" | "md";
}) {
  const [aberto, setAberto] = useState(period === "custom");
  // rascunho local: as duas datas vivem aqui até formarem um intervalo válido
  const [de, setDe] = useState(range.fromIso ?? "");
  const [ate, setAte] = useState(range.toIso ?? "");

  useEffect(() => { setDe(range.fromIso ?? ""); setAte(range.toIso ?? ""); }, [range.fromIso, range.toIso]);

  const btn = size === "sm"
    ? "px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors"
    : "px-5 sm:px-8 py-2.5 rounded-xl text-sm font-extrabold transition-all";

  const escolher = (k: PeriodKind) => {
    if (k === "custom") { setAberto(true); return; }
    setAberto(false);
    onPeriod(k);
  };

  // aplica assim que as duas datas formam um intervalo válido
  const aplicar = (novoDe: string, novoAte: string) => {
    if (!novoDe || !novoAte || novoDe > novoAte) return;
    onRange({ fromIso: novoDe, toIso: novoAte });
    onPeriod("custom");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={size === "sm" ? "flex gap-1" : "inline-flex bg-[var(--surface)] border rounded-2xl p-1.5 gap-1 shadow-sm anim-rise"} role="tablist">
        {PERIOD_KINDS.map((k) => (
          <button key={k} role="tab" aria-selected={period === k} onClick={() => escolher(k)}
            className={`${btn} ${period === k
              ? (size === "sm" ? "bg-[var(--text)] text-[var(--surface)]" : "bg-[var(--text)] text-white shadow")
              : (size === "sm" ? "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]")}`}>
            {PERIOD_LABEL[k]}
          </button>
        ))}
      </div>

      {aberto && (
        <div className="flex items-center gap-2 text-xs">
          <input type="date" aria-label="Data inicial" value={de}
            onChange={(e) => { setDe(e.target.value); aplicar(e.target.value, ate); }}
            className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] tabular-nums" />
          <span className="text-[var(--muted)]">até</span>
          <input type="date" aria-label="Data final" value={ate}
            onChange={(e) => { setAte(e.target.value); aplicar(de, e.target.value); }}
            className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] tabular-nums" />
          {de && ate && de > ate && (
            <span className="text-[var(--red)] font-bold">a data inicial é depois da final</span>
          )}
        </div>
      )}
    </div>
  );
}
