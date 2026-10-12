import { test, expect } from "vitest";
import { pdvTotal, activeTableOrder } from "./pdv";

const products = [{ id: "p1", price_cents: 3000 }, { id: "p2", price_cents: 1500 }];
const addons = [{ id: "a1", price_cents: 400 }];

test("pdvTotal soma produto + adicionais, com clamp de qty 1..20", () => {
  const lines = [
    { id: "p1", qty: 2, addons: ["a1"] },   // (3000+400)*2 = 6800
    { id: "p2", qty: 1, addons: [] },        // 1500
    { id: "p1", qty: 0, addons: [] },        // clamp → 1 → 3000
  ];
  expect(pdvTotal(lines, products, addons)).toBe(6800 + 1500 + 3000);
});

test("pdvTotal ignora addon inexistente (não confia no client)", () => {
  expect(pdvTotal([{ id: "p1", qty: 1, addons: ["fantasma"] }], products, addons)).toBe(3000);
});

test("activeTableOrder: uma mesa ativa por pedido não finalizado", () => {
  const tables = ["t1", "t2", "t3"];
  const orders = [
    { table_id: "t1", status: "preparing" },
    { table_id: "t1", status: "delivered" },   // antigo, não conta
    { table_id: "t3", status: "cancelled" },
  ];
  expect(activeTableOrder(tables, orders)).toEqual(["preparing", null, null]);
});
