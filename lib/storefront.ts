// Adapter Supabase → MenuData (formato da vitrine original).
// Tipos espelham cardapio-digital types.ts; valores vêm das tabelas Kero.
// Preço: Kero guarda centavos (int), original usa reais (float) — conversão v/100.

export type SfOption = { id: string; nome: string; precoExtra: number; is_removal?: boolean; is_separate?: boolean };
export type SfOptionGroup = { id: string; nome: string; obrigatorio: boolean; maxEscolhas: number | null; priceRule?: 'sum' | 'max' | 'avg'; freeAddons?: number | null; minChoices?: number | null; isPreparation?: boolean; is_removal?: boolean; options: SfOption[] };
export type SfVariation = { id: string; nome: string; preco: number };
export type SfCustomField = { id: string; label: string; required: boolean; maxLength: number };
export type SfProduct = {
  id: string; nome: string; descricao: string | null; preco: number;
  foto_url: string | null; destaque: boolean; optionGroups: SfOptionGroup[];
  variations: SfVariation[]; customFields: SfCustomField[];
};
export type SfComboItem = { productId: string; qty: number; optional: boolean };
export type SfCombo = {
  id: string; nome: string; descricao: string | null; preco: number;
  foto_url: string | null; items: SfComboItem[];
};
export type SfCategory = { id: string; nome: string; products: SfProduct[] };
export type SfMenuData = {
  business: { id: string; nome: string; slug: string; logo_url: string | null; whatsapp: string | null; aberto_fechado: boolean; categories: SfCategory[] };
  combos: SfCombo[];
};

type StoreRow = { id: string; nome: string; slug: string; logo_url: string | null; whatsapp: string | null };
type CatRow = { id: string; name: string; sort_order: number; active: boolean };
type ProdRow = {
  id: string; category_id: string; name: string; description: string | null;
  price_cents: number; image_url: string | null; active: boolean; destaque: boolean; sort_order: number;
};
type GroupRow = { id: string; name: string; required: boolean; max_choices: number | null; sort_order: number; price_rule?: string; free_addons?: number | null; min_choices?: number | null; is_preparation?: boolean; is_removal?: boolean };
type AddonRow = { id: string; product_id: string | null; name: string; price_cents: number; active: boolean; group_id: string | null; is_removal: boolean; is_separate: boolean };
type VariationRow = { id: string; product_id: string; name: string; price_cents: number; sort_order: number; active: boolean };
type CustomFieldRow = { id: string; product_id: string; label: string; required: boolean; max_length: number; sort_order: number };
type ComboRow = { id: string; name: string; description: string | null; price_cents: number; image_url: string | null; active: boolean; sort_order: number };
type ComboItemRow = { id: string; combo_id: string; product_id: string; qty: number; optional: boolean; sort_order: number };

const byOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;

/** Adicional vale para o produto se global (product_id null) ou amarrado a ele. */
function aplicaveis(addons: AddonRow[], productId: string): AddonRow[] {
  return addons.filter((a) => a.active && (a.product_id === null || a.product_id === productId));
}

export function mapMenu(input: {
  store: StoreRow; categories: CatRow[]; products: ProdRow[];
  groups: GroupRow[]; addons: AddonRow[]; aberto: boolean;
  variations?: VariationRow[]; customFields?: CustomFieldRow[];
  combos?: ComboRow[]; comboItems?: ComboItemRow[];
}): SfMenuData {
  const { store, aberto } = input;
  const cats = input.categories.filter((c) => c.active).sort(byOrder);
  const categories: SfCategory[] = cats.map((c) => {
    const prods = input.products
      .filter((p) => p.active && p.category_id === c.id)
      .sort(byOrder)
      .map((p) => {
        const ads = aplicaveis(input.addons, p.id);
        const optionGroups: SfOptionGroup[] = input.groups
          .slice()
          .sort(byOrder)
          .map((g) => ({
            id: g.id,
            nome: g.name,
            obrigatorio: g.required,
            maxEscolhas: g.max_choices,
            priceRule: g.price_rule as 'sum' | 'max' | 'avg' | undefined,
            freeAddons: g.free_addons,
            minChoices: g.min_choices,
            isPreparation: g.is_preparation,
            is_removal: g.is_removal,
            options: ads
              .filter((a) => a.group_id === g.id)
              .map((a) => ({ id: a.id, nome: a.name, precoExtra: a.price_cents / 100, is_removal: a.is_removal, is_separate: a.is_separate })),
          }))
          .filter((g) => g.options.length > 0);
        const variations: SfVariation[] = (input.variations ?? [])
          .filter((v) => v.active && v.product_id === p.id)
          .sort(byOrder)
          .map((v) => ({ id: v.id, nome: v.name, preco: v.price_cents / 100 }));
        const customFields: SfCustomField[] = (input.customFields ?? [])
          .filter((cf) => cf.product_id === p.id)
          .sort(byOrder)
          .map((cf) => ({ id: cf.id, label: cf.label, required: cf.required, maxLength: cf.max_length }));
        return {
          id: p.id,
          nome: p.name,
          descricao: p.description,
          preco: p.price_cents / 100,
          foto_url: p.image_url,
          destaque: p.destaque,
          optionGroups,
          variations,
          customFields,
        };
      });
    return { id: c.id, nome: c.name, products: prods };
  });
  const combos: SfCombo[] = (input.combos ?? [])
    .filter((c) => c.active)
    .sort(byOrder)
    .map((c) => ({
      id: c.id,
      nome: c.name,
      descricao: c.description,
      preco: c.price_cents / 100,
      foto_url: c.image_url,
      items: (input.comboItems ?? [])
        .filter((ci) => ci.combo_id === c.id)
        .sort(byOrder)
        .map((ci) => ({ productId: ci.product_id, qty: ci.qty, optional: ci.optional })),
    }));
  return {
    business: { id: store.id, nome: store.nome, slug: store.slug, logo_url: store.logo_url, whatsapp: store.whatsapp ?? null, aberto_fechado: aberto, categories },
    combos,
  };
}
