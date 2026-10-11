// SPEC §10: faixas, final inclusivo; {} → fechada.
import { expect, test } from "vitest";

import { isStoreOpen, nextOpeningLabel } from "./store-hours";

// 2026-10-10 é sábado (getDay 6). Horários em America/Manaus, sem libs de data.
const sat = (hm: string) => new Date(`2026-10-10T${hm}:00-04:00`);
const H = { "6": [["11:00", "23:00"]] };

test("aberto dentro da faixa, fechado fora", () => {
  expect(isStoreOpen(H, sat("12:00"))).toBe(true);
  expect(isStoreOpen(H, sat("10:59"))).toBe(false);
});

test("final inclusivo", () => {
  expect(isStoreOpen(H, sat("23:00"))).toBe(true);
  expect(isStoreOpen(H, sat("23:01"))).toBe(false);
});

test("dia sem faixa e objeto inválido → fechado", () => {
  expect(isStoreOpen({ "0": [["11:00", "23:00"]] }, sat("12:00"))).toBe(false);
  expect(isStoreOpen({}, sat("12:00"))).toBe(false);
  expect(isStoreOpen(null, sat("12:00"))).toBe(false);
  expect(isStoreOpen([], sat("12:00"))).toBe(false);
});

test("nextOpeningLabel: ainda abre hoje vs outro dia vs fechada", () => {
  expect(nextOpeningLabel(H, sat("10:00"))).toBe("Abrimos às 11:00");
  expect(nextOpeningLabel({ "0": [["11:00", "12:00"]] }, sat("13:00"))).toBe("Abrimos domingo às 11:00");
  expect(nextOpeningLabel({}, sat("12:00"))).toBe("Loja fechada");
});
