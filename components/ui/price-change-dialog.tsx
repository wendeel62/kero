import { brl } from "@/app/[slug]/menu-data";

export type PriceLine = { name: string; qty: number; line_total: number };

export default function PriceChangeDialog({ open, lines, originalTotal, correctedTotal, onConfirm, onClose }: {
  open: boolean; lines: PriceLine[]; originalTotal: number; correctedTotal: number;
  onConfirm: () => void; onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      role="dialog" aria-modal="true" aria-label="Preços mudaram">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 anim-pop">
        <p className="font-display font-extrabold text-xl tracking-tight">Preços mudaram</p>
        <p className="text-sm text-stone-500 mt-1">
          Alguns preços mudaram desde que você montou o pedido. Confira o valor corrigido:
        </p>
        <ul className="mt-4 space-y-2 text-sm max-h-56 overflow-y-auto">
          {lines.map((l) => (
            <li key={`${l.name}-${l.qty}`} className="flex justify-between gap-2">
              <span className="truncate text-stone-600">{l.qty}× {l.name}</span>
              <span className="font-bold tabular-nums shrink-0">{brl(l.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-stone-100 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-stone-400">
            <span>Original</span>
            <span className="tabular-nums line-through">{brl(originalTotal)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-extrabold">Corrigido</span>
            <span className="font-display font-extrabold text-2xl tabular-nums">{brl(correctedTotal)}</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose}
            className="border border-stone-200 font-bold rounded-xl px-4 py-3 text-sm hover:bg-stone-50 transition-colors">
            Revisar
          </button>
          <button type="button" onClick={onConfirm}
            className="bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold rounded-xl px-4 py-3 text-sm shadow-lg transition-transform active:scale-[0.99]">
            Confirmar e enviar
          </button>
        </div>
      </div>
    </div>
  );
}
