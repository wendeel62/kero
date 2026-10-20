// Utils puros do carrinho (paridade com lib.ts do original).
import type { SfProduct } from "./storefront";

export type SfEscolha = Record<string, string[]>;
export type SfOpcaoItem = { groupId: string; groupNome: string; optionId: string; optionNome: string; precoExtra: number; is_separate?: boolean };
export type SfCarrinhoItem = { productId: string; nome: string; precoUnit: number; qtd: number; opcoes: SfOpcaoItem[]; total: number; variationId?: string; variationNome?: string; customFieldValues?: Record<string, string> };

export function calcularTotal(produto: SfProduct, escolhas: SfEscolha, precoBase?: number): number {
  const base = precoBase ?? Number(produto.preco);
  const extras = (produto.optionGroups ?? []).reduce((acc, g) => {
    const escolhidas = escolhas[g.id] ?? [];
    const precos = g.options.filter((o) => escolhidas.includes(o.id)).map((o) => Number(o.precoExtra));
    if (precos.length === 0) return acc;
    const rule = g.priceRule ?? 'sum';
    let total = 0;
    if (rule === 'max') {
      total = Math.max(...precos);
    } else if (rule === 'avg') {
      total = precos.reduce((s, p) => s + p, 0) / precos.length;
    } else {
      const free = g.freeAddons ?? 0;
      total = free > 0 ? precos.slice(free).reduce((s, p) => s + p, 0) : precos.reduce((s, p) => s + p, 0);
    }
    return acc + total;
  }, 0);
  return base + extras;
}

export function montarItem(produto: SfProduct, escolhas: SfEscolha, qtd: number, variationId?: string, customFieldValues?: Record<string, string>): SfCarrinhoItem {
  const opcoes = (produto.optionGroups ?? []).flatMap((g) => {
    const escolhidas = escolhas[g.id] ?? [];
    return g.options
      .filter((o) => escolhidas.includes(o.id))
      .map((o) => ({ groupId: g.id, groupNome: g.nome, optionId: o.id, optionNome: o.nome, precoExtra: Number(o.precoExtra), is_separate: o.is_separate }));
  });
  const variacao = variationId ? (produto.variations ?? []).find((v) => v.id === variationId) : undefined;
  const precoUnit = calcularTotal(produto, escolhas, variacao?.preco);
  return { productId: produto.id, nome: produto.nome, precoUnit, qtd, opcoes, total: precoUnit * qtd, variationId: variacao?.id, variationNome: variacao?.nome, customFieldValues };
}

export function editarItem(carrinho: SfCarrinhoItem[], index: number, novo: SfCarrinhoItem): SfCarrinhoItem[] {
  return carrinho.map((item, i) => (i === index ? novo : item));
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
