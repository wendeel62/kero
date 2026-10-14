// SPEC §4/§11: sacola — merge por produto+adicionais+obs; teto 30 linhas; qty 1..20.
import { expect, test } from "vitest";

import {
  addLine, countItems, loadCart, loadInfo, loadLastToken, MAX_LINES, removeLine, saveCart,
  saveInfo, saveLastToken, setQty, type CartLine,
} from "./cart";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  productId: "p1", addonIds: ["a1"], notes: "", qty: 1, ...over,
});

test("mesma linha soma qty (addons em qualquer ordem)", () => {
  const ls = addLine([line({ qty: 1 })], line({ qty: 2, addonIds: ["a1"] }));
  expect(ls).toHaveLength(1);
  expect(ls[0].qty).toBe(3);
});

test("obs ou adicionais diferentes = linhas separadas", () => {
  const ls = addLine(addLine([line()], line({ notes: "sem cebola" })), line({ addonIds: [] }));
  expect(ls).toHaveLength(3);
});

test("teto 30 linhas e qty máx 20", () => {
  const full = Array.from({ length: MAX_LINES }, (_, i) => line({ productId: `p${i}` }));
  expect(addLine(full, line({ productId: "novo" }))).toHaveLength(MAX_LINES);
  expect(addLine([line({ qty: 19 })], line({ qty: 5 }))[0].qty).toBe(20);
  expect(addLine([], line({ qty: 0 }))[0].qty).toBe(1);
});

test("setQty 0 remove; removeLine tira pelo índice; countItems soma", () => {
  const ls = [line({ qty: 2 }), line({ productId: "p2", qty: 3 })];
  expect(setQty(ls, 0, 0)).toHaveLength(1);
  expect(setQty(ls, 0, 5)[0].qty).toBe(5);
  expect(removeLine(ls, 1)).toHaveLength(1);
  expect(countItems(ls)).toBe(5);
});

test("sem localStorage (SSR): load [] e save no-op", () => {
  expect(loadCart("x")).toEqual([]);
  expect(() => saveCart("x", [line()])).not.toThrow();
});

test("sem localStorage (SSR): token do último pedido null e save no-op", () => {
  expect(loadLastToken("x")).toBeNull();
  expect(() => saveLastToken("x", "tok")).not.toThrow();
});

test("sem localStorage (SSR): dados do checkout {} e save no-op", () => {
  expect(loadInfo("x")).toEqual({});
  expect(() =>
    saveInfo("x", { name: "A", phone: "9299", street: "Rua A", number: "10", complement: "", cep: "69000000", hoodId: "h1" }),
  ).not.toThrow();
});
