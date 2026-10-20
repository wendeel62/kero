import { describe, expect, it } from "vitest";
import { mapMenu } from "@/lib/storefront";

// Garante que o select de grupos so pede colunas que existem (apos a
// migracao 033 removeu is_removal/is_separate de product_addon_groups).
// O grupo nao traz mais essas flags; o mapeamento nao deve quebrar.
const store = { id: "s1", nome: "Pizzaria QA", slug: "loja-qa", logo_url: null as string | null, whatsapp: null as string | null };
const categories = [{ id: "c1", name: "Pizzas", sort_order: 1, active: true }];
const products = [{ id: "p1", category_id: "c1", name: "Margherita G", description: "M", price_cents: 4990, image_url: null, active: true, destaque: false, sort_order: 1 }];
const groups = [{ id: "g1", name: "Tamanho da massa", required: true, max_choices: 1, sort_order: 0 }];
const addons = [
  { id: "a1", product_id: null as string | null, name: "Massa fina", price_cents: 0, active: true, group_id: "g1", is_removal: false, is_separate: false },
  { id: "a2", product_id: null as string | null, name: "Massa de chocolate", price_cents: 1500, active: true, group_id: "g1", is_removal: false, is_separate: false },
];

describe("BUG-001: select de grupos de adicionais", () => {
  it("mapeia grupo sem is_removal/is_separate (colunas removidas pela migracao 033)", () => {
    const m = mapMenu({ store, categories, products, groups, addons, aberto: true });
    const gs = m.business.categories[0].products[0].optionGroups;
    expect(gs).toHaveLength(1);
    expect(gs[0].nome).toBe("Tamanho da massa");
    expect(gs[0].obrigatorio).toBe(true);
    expect(gs[0].options).toEqual([
      { id: "a1", nome: "Massa fina", precoExtra: 0, is_removal: false, is_separate: false },
      { id: "a2", nome: "Massa de chocolate", precoExtra: 15, is_removal: false, is_separate: false },
    ]);
  });
});
