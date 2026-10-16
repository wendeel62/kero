import { describe, expect, it } from "vitest";
import { buildQuoteGroups, calcularQuote } from "@/lib/storefront-quote";

const prod = (over = {}) => ({
  id: "p1", price_cents: 4990, active: true,
  groups: [{ id: "g1", required: false, maxChoices: 3, addonIds: ["a1"] as string[] }],
  addonPrices: { a1: 600 } as Record<string, number>,
  ...over,
});

describe("calcularQuote (servidor recalcula, como pricing do original)", () => {
  it("soma base + extras", () => {
    const q = calcularQuote({
      tipo: "delivery",
      feeCents: 500,
      lines: [{ product: prod(), qty: 2, addonIds: ["a1"] }],
    });
    expect(q.subtotal).toBe(11180);
    expect(q.taxaEntrega).toBe(500);
    expect(q.total).toBe(11680);
  });

  it("retirada zera a taxa", () => {
    const q = calcularQuote({ tipo: "retirada", feeCents: 500, lines: [{ product: prod(), qty: 1, addonIds: [] }] });
    expect(q.taxaEntrega).toBe(0);
    expect(q.total).toBe(4990);
  });

  it("rejeita produto inativo, qtd inválida e grupo obrigatório", () => {    expect(() => calcularQuote({ tipo: "delivery", feeCents: 0, lines: [{ product: prod({ active: false }), qty: 1, addonIds: [] }] })).toThrow("produto_nao_encontrado");
    expect(() => calcularQuote({ tipo: "delivery", feeCents: 0, lines: [{ product: prod(), qty: 0, addonIds: [] }] })).toThrow("itens_invalidos");
    expect(() => calcularQuote({ tipo: "x", feeCents: 0, lines: [{ product: prod(), qty: 1, addonIds: [] }] })).toThrow("tipo_invalido");
    const req = prod({ groups: [{ id: "g1", required: true, maxChoices: null, addonIds: ["a1"] }] });
    expect(() => calcularQuote({ tipo: "delivery", feeCents: 0, lines: [{ product: req, qty: 1, addonIds: [] }] })).toThrow("grupo_obrigatorio");
    expect(() => calcularQuote({ tipo: "delivery", feeCents: 0, lines: [{ product: prod(), qty: 1, addonIds: ["a1", "zz"] }] })).toThrow("opcao_invalida");
  });
});

describe("buildQuoteGroups (aplicabilidade por produto, como 013)", () => {
  const groups = [
    { id: "g1", required: true, max_choices: 1 },
    { id: "g2", required: false, max_choices: null },
  ];
  const addons = [
    { id: "a1", product_id: null as string | null, group_id: "g1" },
    { id: "a2", product_id: "outro", group_id: "g1" },
    { id: "a3", product_id: "p9", group_id: "g2" },
  ];
  it("só inclui addons aplicáveis e omite grupo vazio", () => {
    expect(buildQuoteGroups(groups, addons, "p1")).toEqual([{ id: "g1", required: true, maxChoices: 1, addonIds: ["a1"] }]);
  });
});

describe("teto de qty (espelho RPC clamp 1..20)", () => {
  it("fixa qty gigante em 20", () => {
    const q = calcularQuote({ tipo: "retirada", feeCents: 0, lines: [{ product: prod(), qty: 99, addonIds: [] }] });
    expect(q.itens[0].qtd).toBe(20);
    expect(q.subtotal).toBe(4990 * 20);
  });
});
