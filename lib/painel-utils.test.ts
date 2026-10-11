// Mapeamento linha do banco/Realtime → PanelOrder (puro, testável sem DB).
import { expect, test } from "vitest";

import { toPanelOrder, type PanelRow } from "./painel-utils";

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
