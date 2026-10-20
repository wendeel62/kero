// Grupos de adicional (design D4) — puro, sem banco.
// Regra de aplicabilidade: um grupo so incide sobre o produto se tem ao menos
// um adicional ativo; quem chama passa apenas os adicionais daquele produto.
// Sem essa regra, um grupo obrigatorio cujo unico adicional foi desativado
// travaria a venda (Review Focus #3).
export const IMPLICIT_GROUP_NAME = "Adicionais";

export type AddonRow = { id: string; name: string; price_cents: number; group_id: string | null; active: boolean };
export type AddonGroupRow = { id: string; name: string; required: boolean; max_choices: number | null; sort_order: number; price_rule: string; free_addons: number | null; min_choices: number | null; is_preparation: boolean; is_removal: boolean; is_separate: boolean };
export type AddonGroup = { id: string | null; name: string; required: boolean; maxChoices: number | null; addons: AddonRow[] };

export function groupAddons(addons: AddonRow[], groups: AddonGroupRow[]): AddonGroup[] {
  const ativos = addons.filter((x) => x.active);
  const out: AddonGroup[] = [];
  for (const g of [...groups].sort((x, y) => x.sort_order - y.sort_order)) {
    const membros = ativos.filter((x) => x.group_id === g.id);
    if (membros.length > 0) {
      out.push({ id: g.id, name: g.name, required: g.required, maxChoices: g.max_choices, addons: membros });
    }
  }
  const soltos = ativos.filter((x) => x.group_id === null);
  if (soltos.length > 0) {
    out.push({ id: null, name: IMPLICIT_GROUP_NAME, required: false, maxChoices: null, addons: soltos });
  }
  return out;
}

export function validateChoice(
  groups: AddonGroup[], chosenIds: string[]
): { ok: true } | { ok: false; error: string } {
  for (const g of groups) {
    const escolhidos = g.addons.filter((x) => chosenIds.includes(x.id)).length;
    if (g.required && escolhidos === 0) {
      return { ok: false, error: `Escolha uma opção em "${g.name}".` };
    }
    if (g.maxChoices !== null && escolhidos > g.maxChoices) {
      return { ok: false, error: `"${g.name}" aceita no máximo ${g.maxChoices} escolha(s).` };
    }
  }
  return { ok: true };
}

export function priceOf(addons: AddonRow[], chosenIds: string[]): number {
  return addons.filter((x) => chosenIds.includes(x.id)).reduce((s, x) => s + x.price_cents, 0);
}
