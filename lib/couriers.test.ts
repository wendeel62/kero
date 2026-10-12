import { test, expect } from "vitest";
import { posicaoRecente } from "./couriers";

test("posicaoRecente: recente = true, antiga = false", () => {
  const agora = Date.parse("2026-10-12T12:00:00Z");
  expect(posicaoRecente("2026-10-12T11:59:00Z", agora)).toBe(true);
  expect(posicaoRecente("2026-10-12T11:50:00Z", agora)).toBe(false);
});
