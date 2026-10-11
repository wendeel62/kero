import { test, expect } from "vitest";
import { parsePeriodKind, resolvePeriod } from "./period";

// 2026-10-11T14:30:00Z = 2026-10-11 10:30 em Manaus (UTC-4 fixo)
const NOW = new Date("2026-10-11T14:30:00Z");

test("parsePeriodKind aceita as chaves conhecidas e cai em today no lixo", () => {
  expect(parsePeriodKind("7d")).toBe("7d");
  expect(parsePeriodKind("90d")).toBe("90d");
  expect(parsePeriodKind(undefined)).toBe("today");
  expect(parsePeriodKind("")).toBe("today");
  expect(parsePeriodKind("30")).toBe("today");
  expect(parsePeriodKind("<script>")).toBe("today");
});

test("resolvePeriod('today') é a meia-noite de Manaus até a próxima (exclusivo)", () => {
  const p = resolvePeriod("today", { now: NOW });
  expect(p.from).toBe("2026-10-11T04:00:00.000Z");
  expect(p.to).toBe("2026-10-12T04:00:00.000Z");
});

test("resolvePeriod('7d') cobre 7 dias de calendário de Manaus, inclusive hoje", () => {
  const p = resolvePeriod("7d", { now: NOW });
  expect(p.from).toBe("2026-10-05T04:00:00.000Z");
  expect(p.to).toBe("2026-10-12T04:00:00.000Z");
});

test("resolvePeriod custom usa as datas dadas, com to exclusivo", () => {
  const p = resolvePeriod("custom", { fromIso: "2026-10-01", toIso: "2026-10-03", now: NOW });
  expect(p.from).toBe("2026-10-01T04:00:00.000Z");
  expect(p.to).toBe("2026-10-04T04:00:00.000Z");
});

test("resolvePeriod custom com data invertida ou lixo cai em 7d (nunca intervalo vazio)", () => {
  const invertida = resolvePeriod("custom", { fromIso: "2026-10-05", toIso: "2026-10-01", now: NOW });
  expect(invertida).toEqual(resolvePeriod("7d", { now: NOW }));
  const lixo = resolvePeriod("custom", { fromIso: "ontem", toIso: "2026-10-03", now: NOW });
  expect(lixo).toEqual(resolvePeriod("7d", { now: NOW }));
});

test("resolvePeriod sempre devolve from < to", () => {
  for (const kind of ["today", "7d", "30d", "90d"] as const) {
    const p = resolvePeriod(kind, { now: NOW });
    expect(new Date(p.from).getTime()).toBeLessThan(new Date(p.to).getTime());
  }
});
