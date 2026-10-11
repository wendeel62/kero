"use client";

import { parseBRLToCents } from "@/lib/pricing";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// R$ → centavos int com prévia ao vivo (PAINEL-07, DS §8.11).
export default function PriceInput({
  id, value, onChange, placeholder = "49,90",
}: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const cents = parseBRLToCents(value);
  return (
    <div>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} inputMode="decimal"
        className="w-full text-sm border rounded-xl px-3.5 py-2.5 bg-[var(--surface-2)] focus:bg-[var(--surface)] focus:border-[var(--red)] outline-none transition-all tabular-nums" />
      <p className="text-[11px] text-[var(--muted)] mt-1 tabular-nums">
        {value === "" ? "formato 49,90"
          : Number.isFinite(cents) ? `= ${brl(cents)} · ${cents} centavos (int, nunca float)`
          : "preço inválido — use formato 49,90"}
      </p>
    </div>
  );
}
