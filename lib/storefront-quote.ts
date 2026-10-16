// Quote servidor da vitrine (paridade com pricing/checkout do original).
// Puro e testável: a rota resolve preços/grupos do banco e chama calcularQuote.
// Travas com os mesmos códigos do original: tipo_invalido, itens_invalidos,
// produto_nao_encontrado, grupo_obrigatorio, max_escolhas, opcao_invalida.

export type QuoteGroup = { id: string; required: boolean; maxChoices: number | null; addonIds: string[] };
export type QuoteProduct = {
  id: string; price_cents: number; active: boolean;
  groups: QuoteGroup[]; addonPrices: Record<string, number>;
};
export type QuoteLine = { product: QuoteProduct; qty: number; addonIds: string[] };
export type QuoteResult = {
  subtotal: number; taxaEntrega: number; desconto: number; total: number;
  itens: Array<{ productId: string; qtd: number; precoUnit: number; total: number }>;
};

const TIPOS = ["delivery", "retirada", "mesa"];

function fail(code: string): never {
  throw new Error(code);
}

export type RawGroup = { id: string; required: boolean; max_choices: number | null };
export type RawAddon = { id: string; product_id: string | null; group_id: string | null };

/** Grupos aplicáveis ao produto (global ou amarrado), omitindo grupo vazio.
 * Paridade com groupAddons + enforcement 013: grupo só incide se tem ao
 * menos um adicional ativo aplicável. */
export function buildQuoteGroups(
  groups: RawGroup[],
  addons: RawAddon[],
  productId: string,
): QuoteGroup[] {
  const out: QuoteGroup[] = [];
  for (const g of groups) {
    const ids = addons
      .filter((a) => a.group_id === g.id && (a.product_id === null || a.product_id === productId))
      .map((a) => a.id);
    if (ids.length > 0) out.push({ id: g.id, required: g.required, maxChoices: g.max_choices, addonIds: ids });
  }
  return out;
}

export function calcularQuote(input: { tipo: string; feeCents: number; lines: QuoteLine[] }): QuoteResult {
  const { tipo, feeCents, lines } = input;
  if (!TIPOS.includes(tipo)) fail("tipo_invalido");
  if (!lines.length || lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1)) fail("itens_invalidos");

  const itens = lines.map((l) => {
    const p = l.product;
    if (!p.active) fail("produto_nao_encontrado");
    const qty = Math.min(l.qty, 20); // teto do RPC (clamp 1..20)
    let extras = 0;
    for (const id of l.addonIds) {
      const price = p.addonPrices[id];
      if (price === undefined) fail("opcao_invalida");
      extras += price;
    }
    for (const g of p.groups) {
      const n = l.addonIds.filter((id) => g.addonIds.includes(id)).length;
      if (g.required && n === 0) fail("grupo_obrigatorio");
      if (g.maxChoices !== null && n > g.maxChoices) fail("max_escolhas");
    }
    const precoUnit = p.price_cents + extras;
    return { productId: p.id, qtd: qty, precoUnit, total: precoUnit * qty };
  });

  const subtotal = itens.reduce((s, i) => s + i.total, 0);
  const taxaEntrega = tipo === "delivery" ? feeCents : 0;
  const desconto = 0;
  return { subtotal, taxaEntrega, desconto, total: subtotal + taxaEntrega - desconto, itens };
}
