import { describe, expect, it } from "vitest";
import { calcularTotal, editarItem, formatarMoeda, montarItem } from "@/lib/storefront-cart";

const produto = {
  id: "p1", nome: "X", descricao: "", preco: 25.9, foto_url: null, destaque: false,
  optionGroups: [{ id: "g1", nome: "Adicionais", obrigatorio: false, maxEscolhas: 3, options: [{ id: "a1", nome: "Bacon", precoExtra: 5 }] }],
};

describe("storefront-cart (paridade lib do original)", () => {
  it("calcularTotal soma base + extras", () => {
    expect(calcularTotal(produto, {})).toBe(25.9);
    expect(calcularTotal(produto, { g1: ["a1"] })).toBe(30.9);
  });

  it("montarItem tira snapshot das opções e totaliza", () => {
    const item = montarItem(produto, { g1: ["a1"] }, 2);
    expect(item).toMatchObject({ productId: "p1", precoUnit: 30.9, qtd: 2, total: 61.8 });
    expect(item.opcoes).toEqual([{ groupId: "g1", groupNome: "Adicionais", optionId: "a1", optionNome: "Bacon", precoExtra: 5 }]);
  });

  it("editarItem substitui no índice sem mutar", () => {
    const base = [montarItem(produto, {}, 1)];
    const novo = montarItem(produto, { g1: ["a1"] }, 3);
    const out = editarItem(base, 0, novo);
    expect(out[0]).toBe(novo);
    expect(base[0].qtd).toBe(1);
  });

  it("formatarMoeda em BRL", () => {
    expect(formatarMoeda(25.9)).toBe("R$ 25,90");
  });
});
