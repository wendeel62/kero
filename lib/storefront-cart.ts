// Utils puros do carrinho (paridade com lib.ts do original).
import type { SfProduct } from "./storefront";

export type SfEscolha = Record<string, string[]>;
export type SfOpcaoItem = { groupId: string; groupNome: string; optionId: string; optionNome: string; precoExtra: number };
export type SfCarrinhoItem = { productId: string; nome: string; precoUnit: number; qtd: number; opcoes: SfOpcaoItem[]; total: number };

export function calcularTotal(produto: SfProduct, escolhas: SfEscolha): number {
  const base = Number(produto.preco);
  const extras = (produto.optionGroups ?? []).reduce((acc, g) => {
    const escolhidas = escolhas[g.id] ?? [];
    return acc + g.options.filter((o) => escolhidas.includes(o.id)).reduce((s, o) => s + Number(o.precoExtra), 0);
  }, 0);
  return base + extras;
}

export function montarItem(produto: SfProduct, escolhas: SfEscolha, qtd: number): SfCarrinhoItem {
  const opcoes = (produto.optionGroups ?? []).flatMap((g) => {
    const escolhidas = escolhas[g.id] ?? [];
    return g.options
      .filter((o) => escolhidas.includes(o.id))
      .map((o) => ({ groupId: g.id, groupNome: g.nome, optionId: o.id, optionNome: o.nome, precoExtra: Number(o.precoExtra) }));
  });
  const precoUnit = calcularTotal(produto, escolhas);
  return { productId: produto.id, nome: produto.nome, precoUnit, qtd, opcoes, total: precoUnit * qtd };
}

export function editarItem(carrinho: SfCarrinhoItem[], index: number, novo: SfCarrinhoItem): SfCarrinhoItem[] {
  return carrinho.map((item, i) => (i === index ? novo : item));
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
