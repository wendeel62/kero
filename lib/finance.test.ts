import { test, expect } from "vitest";
import { cashSummary, payableStatus, netRevenue } from "./finance";

test("cashSummary: saldo = abertura + entradas - saidas; diff = contado - esperado", () => {
  const session = { opening_cents: 10000, closing_cents: 25000 };
  const movements = [
    { direction: "in" as const, amount_cents: 20000, note: "" },
    { direction: "out" as const, amount_cents: 5000, note: "troco" },
  ];
  const s = cashSummary(session, movements, 0);
  expect(s.entradas).toBe(20000);
  expect(s.saidas).toBe(5000);
  expect(s.saldo).toBe(25000);        // 10000+20000-5000
  expect(s.expected).toBe(25000);
  expect(s.diff).toBe(0);
});

test("cashSummary: caixa aberto (sem closing) tem diff null", () => {
  const s = cashSummary({ opening_cents: 0, closing_cents: null }, [], 0);
  expect(s.diff).toBeNull();
});

test("payableStatus: atrasada só quando não paga e vencida", () => {
  const hoje = "2026-10-11";
  expect(payableStatus({ paid: false, due_date: "2026-10-01" }, hoje)).toBe("atrasada");
  expect(payableStatus({ paid: false, due_date: "2026-10-20" }, hoje)).toBe("pendente");
  expect(payableStatus({ paid: true, due_date: "2026-10-01" }, hoje)).toBe("paga");
});

test("netRevenue: liquido = bruto - despesas pagas", () => {
  expect(netRevenue(50000, 20000)).toBe(30000);
});

test("cashSummary: faturamento do dia entra como entrada implícita no esperado", () => {
  const s = cashSummary({ opening_cents: 0, closing_cents: 30000 }, [], 30000);
  expect(s.expected).toBe(30000);     // abertura + vendas do dia
});
