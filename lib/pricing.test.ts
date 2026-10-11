// R$ → centavos int (nunca float) — usado por price-input e config.
import { expect, test } from "vitest";

import { parseBRLToCents } from "./pricing";

test("parseBRLToCents: vírgula decimal, ponto de milhar", () => {
  expect(parseBRLToCents("49,90")).toBe(4990);
  expect(parseBRLToCents("1.234,56")).toBe(123456);
  expect(parseBRLToCents("25")).toBe(2500);
  expect(parseBRLToCents("R$ 10,00")).toBe(1000);
});

test("parseBRLToCents: inválido → NaN", () => {
  expect(parseBRLToCents("")).toBeNaN();
  expect(parseBRLToCents("abc")).toBeNaN();
  expect(parseBRLToCents("-5,00")).toBeNaN();
});
