// Financeiro (recon §5): caixa + contas a pagar. "Líquido" = bruto − despesas
// PAGAS no período (não há custo de produto em nenhum dos dois projetos).
export type CashMovement = { direction: "in" | "out"; amount_cents: number; note: string };

export function cashSummary(
  session: { opening_cents: number; closing_cents: number | null },
  movements: CashMovement[],
  salesCents: number
): { entradas: number; saidas: number; saldo: number; expected: number; diff: number | null } {
  const entradas = movements.filter((m) => m.direction === "in").reduce((s, m) => s + m.amount_cents, 0);
  const saidas = movements.filter((m) => m.direction === "out").reduce((s, m) => s + m.amount_cents, 0);
  const saldo = session.opening_cents + entradas - saidas;
  const expected = saldo + salesCents;
  const diff = session.closing_cents === null ? null : session.closing_cents - expected;
  return { entradas, saidas, saldo, expected, diff };
}

export function payableStatus(
  account: { paid: boolean; due_date: string },
  todayISO: string
): "pendente" | "atrasada" | "paga" {
  if (account.paid) return "paga";
  return account.due_date < todayISO ? "atrasada" : "pendente";
}

export function netRevenue(revenueCents: number, paidExpensesCents: number): number {
  return revenueCents - paidExpensesCents;
}
