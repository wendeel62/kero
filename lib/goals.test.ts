import { test, expect } from "vitest";
import { goalProgress, windowFor } from "./goals";

// 2026-10-11T14:30:00Z = sabado 2026-10-11 10:30 em Manaus
const NOW = new Date("2026-10-11T14:30:00Z");

test("windowFor daily e o dia de Manaus, to exclusivo", () => {
  expect(windowFor("daily", NOW)).toEqual({
    from: "2026-10-11T04:00:00.000Z", to: "2026-10-12T04:00:00.000Z",
  });
});

test("windowFor weekly comeca na segunda-feira de Manaus", () => {
  // 2026-10-11 e sabado; segunda da mesma semana e 2026-10-05
  const w = windowFor("weekly", NOW);
  expect(w.from).toBe("2026-10-05T04:00:00.000Z");
  expect(w.to).toBe("2026-10-12T04:00:00.000Z");
});

test("windowFor monthly cobre o mes corrente de Manaus", () => {
  const m = windowFor("monthly", NOW);
  expect(m.from).toBe("2026-10-01T04:00:00.000Z");
  expect(m.to).toBe("2026-11-01T04:00:00.000Z");
});

test("goalProgress nunca divide por zero nem passa de 100%", () => {
  expect(goalProgress(0, 10000)).toBeNull();
  expect(goalProgress(-1, 10000)).toBeNull();
  expect(goalProgress(10000, 0)).toEqual({ ratio: 0, percent: 0 });
  expect(goalProgress(10000, 5000)).toEqual({ ratio: 0.5, percent: 50 });
  expect(goalProgress(10000, 10000)).toEqual({ ratio: 1, percent: 100 });
  expect(goalProgress(10000, 25000)).toEqual({ ratio: 1, percent: 100 }); // clamp
});
