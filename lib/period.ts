// Janela de período do painel (design C7): UM helper para todas as telas.
// Fronteiras em America/Manaus; `to` é EXCLUSIVO (meia-noite seguinte).
import { manausDayStartISO } from "./painel-utils";

export type PeriodKind = "today" | "7d" | "30d" | "90d" | "custom";
export const PERIOD_KINDS: readonly PeriodKind[] = ["today", "7d", "30d", "90d", "custom"];
export const PERIOD_LABEL: Record<PeriodKind, string> = {
  today: "Hoje", "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", custom: "Personalizado",
};

export function parsePeriodKind(v: string | undefined | null): PeriodKind {
  return (PERIOD_KINDS as readonly string[]).includes(v ?? "") ? (v as PeriodKind) : "today";
}

// Range do período "custom" (YYYY-MM-DD). Opcional: sem as duas datas,
// resolvePeriod cai em 7d — nunca devolve intervalo vazio em silêncio.
export type CustomRange = { fromIso?: string; toIso?: string };

const DAY_MS = 86_400_000;
// "2026-10-01" → meia-noite de Manaus daquele dia (ISO UTC).
// Meio-dia UTC garante que o instante cai no dia certo em Manaus (UTC-4).
const dayStart = (ymd: string): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? manausDayStartISO(new Date(`${ymd}T12:00:00Z`)) : null;

export function resolvePeriod(
  kind: PeriodKind,
  opts: { fromIso?: string; toIso?: string; now?: Date } = {}
): { from: string; to: string } {
  const now = opts.now ?? new Date();
  const hojeStart = new Date(manausDayStartISO(now));
  const toExclusivo = new Date(hojeStart.getTime() + DAY_MS).toISOString();
  const dias = { today: 1, "7d": 7, "30d": 30, "90d": 90 } as const;

  if (kind === "custom") {
    const from = opts.fromIso ? dayStart(opts.fromIso) : null;
    const to = opts.toIso ? dayStart(opts.toIso) : null;
    // invertido ou inválido → 7d (Review Focus #5); nunca intervalo vazio em silêncio
    if (from && to && new Date(from) < new Date(to)) {
      return { from, to: new Date(new Date(to).getTime() + DAY_MS).toISOString() };
    }
    return resolvePeriod("7d", { now });
  }

  const from = new Date(hojeStart.getTime() - (dias[kind] - 1) * DAY_MS).toISOString();
  return { from, to: toExclusivo };
}
