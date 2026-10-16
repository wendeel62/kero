import { describe, expect, it } from "vitest";
import { mapMenu } from "@/lib/storefront";

const store = { id: "s1", nome: "Pizzaria da Sol", slug: "pizza-do-joao", logo_url: null as string | null };
const categories = [
  { id: "c1", name: "Pizzas", sort_order: 1, active: true },
  { id: "c2", name: "Oculta", sort_order: 0, active: false },
];
const products = [
  { id: "p1", category_id: "c1", name: "Margherita G", description: "Muçarela", price_cents: 4990, image_url: null as string | null, active: true, destaque: true, sort_order: 1 },
  { id: "p2", category_id: "c1", name: "Velha", description: "", price_cents: 100, image_url: null, active: false, destaque: false, sort_order: 0 },
];
const groups = [{ id: "g1", name: "adicionais", required: false, max_choices: 3, sort_order: 0 }];
const addons = [{ id: "a1", product_id: null as string | null, name: "Bacon", price_cents: 600, active: true, group_id: "g1" }];

describe("mapMenu (paridade MenuData do original)", () => {
  it("mapeia loja, filtra inativos e converte centavos", () => {
    const m = mapMenu({ store, categories, products, groups, addons, aberto: true });
    expect(m.business.nome).toBe("Pizzaria da Sol");
    expect(m.business.aberto_fechado).toBe(true);
    expect(m.business.categories.map((c) => c.nome)).toEqual(["Pizzas"]);
    const ps = m.business.categories[0].products;
    expect(ps).toHaveLength(1);
    expect(ps[0].nome).toBe("Margherita G");
    expect(ps[0].preco).toBe(49.9);
    expect(ps[0].destaque).toBe(true);
    expect(ps[0].foto_url).toBeNull();
  });

  it("anexa grupos com options e maxEscolhas", () => {
    const m = mapMenu({ store, categories, products, groups, addons, aberto: false });
    const gs = m.business.categories[0].products[0].optionGroups;
    expect(gs).toHaveLength(1);
    expect(gs[0]).toMatchObject({ nome: "adicionais", obrigatorio: false, maxEscolhas: 3 });
    expect(gs[0].options).toEqual([{ id: "a1", nome: "Bacon", precoExtra: 6 }]);
  });
});
