// Check do mapa produto→complementos usado pelo PDV (defeito: carrinho oferecia
// os complementos da loja inteira para qualquer item). Puro, sem banco.
import { expect, test } from "vitest";
import { addonIdsByProduct } from "@/lib/painel-utils";
import type { PanelAddon } from "@/lib/painel-utils";
import type { AddonGroupRow } from "@/lib/addon-groups";

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

test("grupo expoe as regras de preço, escolhas e preparo", () => {
  const group: AddonGroupRow = {
    id: "borda", name: "Borda", required: true, max_choices: 1, sort_order: 0,
    price_rule: "max", free_addons: 1, min_choices: 0, is_preparation: true,
    is_removal: false, is_separate: false,
  };
  expect(group.price_rule).toBe("max");
  expect(group.free_addons).toBe(1);
  expect(group.min_choices).toBe(0);
  expect(group.is_preparation).toBe(true);
});

test("complemento expoe flags de remoção e cobrança separada", () => {
  const addon: PanelAddon = {
    id: "a1", name: "Bacon", price_cents: 500, active: true, group_id: null,
    is_removal: false, is_separate: true,
  };
  expect(addon.is_removal).toBe(false);
  expect(addon.is_separate).toBe(true);
});
