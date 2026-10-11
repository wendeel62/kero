// SPEC §10: pricing em centavos int — subtotal, addons, taxa, mínimo, troco.
import { expect, test } from "vitest";

import {
  lineTotal, meetsMinimum, subtotal, total, unitPrice, validateChange,
} from "./pricing";

test("unitPrice soma base + adicionais", () => {
  expect(unitPrice({ price_cents: 4990, qty: 1 })).toBe(4990);
  expect(unitPrice({ price_cents: 4990, qty: 2, addons: [600, 450] })).toBe(6040);
});

test("lineTotal multiplica por qty com clamp 1..20", () => {
  expect(lineTotal({ price_cents: 1000, qty: 2 })).toBe(2000);
  expect(lineTotal({ price_cents: 1000, qty: 0 })).toBe(1000);
  expect(lineTotal({ price_cents: 1000, qty: 99 })).toBe(20000);
});

test("subtotal + total com taxa", () => {
  const items = [
    { price_cents: 4990, qty: 2, addons: [600] },
    { price_cents: 690, qty: 1 },
  ];
  expect(subtotal(items)).toBe(2 * 5590 + 690);
  expect(total(11870, 500)).toBe(12370);
});

test("meetsMinimum vale sobre o subtotal", () => {
  expect(meetsMinimum(2500, 2500)).toBe(true);
  expect(meetsMinimum(2499, 2500)).toBe(false);
});

test("validateChange: cash exige troco ≥ total; resto → null", () => {
  expect(validateChange("cash", 15000, 12370)).toEqual({ ok: true, changeForCents: 15000 });
  expect(validateChange("cash", 10000, 12370).ok).toBe(false);
  expect(validateChange("cash", null, 12370).ok).toBe(false);
  expect(validateChange("pix", 999, 12370)).toEqual({ ok: true, changeForCents: null });
  expect(validateChange("card_machine", null, 12370)).toEqual({ ok: true, changeForCents: null });
});
