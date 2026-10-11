// SPEC §4: wa.me com 55 default e texto encodado.
import { expect, test } from "vitest";

import { waLink } from "./wa";

test("normaliza dígitos, 55 default, mantém 55 existente", () => {
  expect(waLink("(11) 98765-4321")).toBe("https://wa.me/5511987654321");
  expect(waLink("5511987654321")).toBe("https://wa.me/5511987654321");
  expect(waLink("011987654321")).toBe("https://wa.me/5511987654321");
});

test("texto vira ?text= encodado", () => {
  expect(waLink("11987654321", "Olá! Pedido #AB12")).toBe(
    "https://wa.me/5511987654321?text=Ol%C3%A1!%20Pedido%20%23AB12",
  );
});
