// Meta de faturamento (design D2): so o ALVO e gravado; a janela e derivada aqui.
import { manausDayStartISO } from "./painel-utils";

export type GoalPeriod = "daily" | "weekly" | "monthly";
export const GOAL_PERIODS: readonly GoalPeriod[] = ["daily", "weekly", "monthly"];
export const GOAL_LABEL: Record<GoalPeriod, string> = {
  daily: "Meta do dia", weekly: "Meta da semana", monthly: "Meta do mês",
};

const DAY_MS = 86_400_000;

export function windowFor(period: GoalPeriod, now: Date = new Date()): { from: string; to: string } {
  const hoje = new Date(manausDayStartISO(now));
  if (period === "daily") {
    return { from: hoje.toISOString(), to: new Date(hoje.getTime() + DAY_MS).toISOString() };
  }
  if (period === "weekly") {
    // dia da semana em Manaus; getUTCDay de `hoje` (04:00Z) e o dia local correto
    const dow = hoje.getUTCDay();                 // 0=domingo
    const segunda = new Date(hoje.getTime() - ((dow + 6) % 7) * DAY_MS);
    return { from: segunda.toISOString(), to: new Date(segunda.getTime() + 7 * DAY_MS).toISOString() };
  }
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1, 4));
  const inicioMesSeguinte = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1, 4));
  return { from: inicioMes.toISOString(), to: inicioMesSeguinte.toISOString() };
}

export function goalProgress(
  targetCents: number, revenueCents: number
): { ratio: number; percent: number } | null {
  if (!(targetCents > 0)) return null; // Review Focus #2: sem meta, sem bloco
  const ratio = Math.min(Math.max(revenueCents / targetCents, 0), 1);
  return { ratio, percent: Math.round(ratio * 100) };
}
