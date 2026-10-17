// Mapeamento linha do banco/Realtime → PanelOrder (puro, testável sem DB).
import { expect, test } from "vitest";

import { toPanelOrder, resumoPedidos, type PanelRow } from "./painel-utils";

const row = (over: Partial<PanelRow> = {}): PanelRow => ({
  id: "o1", code: "K7M2", customer_name: "Maria", type: "delivery",
  payment_method: "cash", total_cents: 10480, status: "new",
  created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  ...over,
});

test("toPanelOrder: nomes, pagamento PT-BR e há N min", () => {
  const o = toPanelOrder(row(), Date.now());
  expect(o.customer).toBe("Maria");
  expect(o.payment).toBe("Dinheiro");
  expect(o.minutesAgo).toBe(12);
  expect(o.code).toBe("K7M2");
});

test("toPanelOrder: pix/maquininha e método desconhecido passa cru", () => {
  expect(toPanelOrder(row({ payment_method: "pix" }), Date.now()).payment).toBe("Pix");
  expect(toPanelOrder(row({ payment_method: "card_machine" }), Date.now()).payment).toBe("Maquininha");
  expect(toPanelOrder(row({ payment_method: "voucher" }), Date.now()).payment).toBe("voucher");
});

test("toPanelOrder: futuro arredonda p/ 0, nunca negativo", () => {
  const o = toPanelOrder(row({ created_at: new Date(Date.now() + 60000).toISOString() }), Date.now());
  expect(o.minutesAgo).toBe(0);
});

test("resumoPedidos: taxa de cancelamento, aguardando >10min e split por tipo", () => {
  const now = Date.now();
  const min = (m: number) => new Date(now - m * 60000).toISOString();
  const orders = [
    toPanelOrder(row({ id: "a", status: "new", type: "delivery", created_at: min(14) }), now),
    toPanelOrder(row({ id: "b", status: "new", type: "pickup", created_at: min(5) }), now),
    toPanelOrder(row({ id: "c", status: "confirmed", type: "dine_in", created_at: min(30) }), now),
    toPanelOrder(row({ id: "d", status: "cancelled", type: "delivery", created_at: min(60) }), now),
  ];
  const r = resumoPedidos(orders);
  expect(r.total).toBe(4);
  expect(r.cancelados).toBe(1);
  expect(r.perdidaCents).toBe(10480);
  expect(r.taxaCancelamento).toBeCloseTo(0.25);
  expect(r.aguardando10min).toBe(1);
  expect(r.split).toEqual({ delivery: 1, pickup: 1, dine_in: 1 }); // split só válidos (exc. cancelados, como o faturamento)
});

test("resumoPedidos: vazio zera tudo sem NaN", () => {
  const r = resumoPedidos([]);
  expect(r).toEqual({ total: 0, cancelados: 0, perdidaCents: 0, taxaCancelamento: 0, aguardando10min: 0, split: { delivery: 0, pickup: 0, dine_in: 0 } });
});
