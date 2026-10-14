// Check do mapa produto→complementos usado pelo PDV (defeito: carrinho oferecia
// os complementos da loja inteira para qualquer item). Puro, sem banco.
import { expect, test } from "vitest";
import { addonIdsByProduct } from "@/lib/painel-utils";

test("addonIdsByProduct agrupa os links por produto; produto sem link não entra no mapa", () => {
  const map = addonIdsByProduct([
    { id: "a1", product_id: "p1" },
    { id: "a2", product_id: "p1" },
    { id: "a3", product_id: "p2" },
  ]);
  expect(map.get("p1")).toEqual(["a1", "a2"]);
  expect(map.get("p2")).toEqual(["a3"]);
  expect(map.get("p-sem-addons")).toBeUndefined();
});

test("addonIdsByProduct com lista vazia devolve mapa vazio", () => {
  expect(addonIdsByProduct([]).size).toBe(0);
});
