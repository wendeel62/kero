// Guards de regressão do live (RT-02/RT-03): sem gesto/documento, silêncio total.
// Contrato de duração (≤150ms): agenda no código — 0.07s + 0.075s = 0.145s.
import { expect, test } from "vitest";

import { playNewOrderSound, updateFaviconBadge } from "./painel-live";

test("som sem gesto prévio: no-op, sem throw", () => {
  expect(playNewOrderSound()).toBeUndefined();
});

test("badge sem document (SSR/node): no-op, sem throw", () => {
  expect(updateFaviconBadge(3)).toBeUndefined();
  expect(updateFaviconBadge(0)).toBeUndefined();
});
