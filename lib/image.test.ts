// SPEC v3 §4 + DS §4.12 (emenda v3.1 #8): WebP client-side; dimensão nunca rejeita,
// só redimensiona; rejeita só tipo não-imagem ou >1MB APÓS compressão.
import { expect, test } from "vitest";

import { MAX_IMAGE_BYTES, MAX_IMAGE_WIDTH, pickQuality, shouldRejectType } from "./image";

test("limites: 1MB e 1200px", () => {
  expect(MAX_IMAGE_BYTES).toBe(1024 * 1024);
  expect(MAX_IMAGE_WIDTH).toBe(1200);
});

test("só imagem passa no tipo", () => {
  expect(shouldRejectType("image/jpeg")).toBe(false);
  expect(shouldRejectType("image/webp")).toBe(false);
  expect(shouldRejectType("application/pdf")).toBe(true);
  expect(shouldRejectType("text/plain")).toBe(true);
  expect(shouldRejectType("")).toBe(true);
});

test("qualidade na faixa 80–100, cai com o tamanho", () => {
  const small = pickQuality(100 * 1024);
  const mid = pickQuality(600 * 1024);
  const big = pickQuality(3 * 1024 * 1024);
  expect(small).toBe(1);
  expect(mid).toBeLessThan(small);
  expect(big).toBe(0.8);
  for (const q of [small, mid, big]) {
    expect(q).toBeGreaterThanOrEqual(0.8);
    expect(q).toBeLessThanOrEqual(1);
  }
});
