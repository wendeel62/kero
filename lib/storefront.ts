// Adapter Supabase → MenuData (formato da vitrine original).
// Tipos espelham cardapio-digital types.ts; valores vêm das tabelas Kero.
// Preço: Kero guarda centavos (int), original usa reais (float) — conversão v/100.

export type SfOption = { id: string; nome: string; precoExtra: number };
export type SfOptionGroup = { id: string; nome: string; obrigatorio: boolean; maxEscolhas: number | null; options: SfOption[] };
export type SfProduct = {
  id: string; nome: string; descricao: string | null; preco: number;
  foto_url: string | null; destaque: boolean; optionGroups: SfOptionGroup[];
};
export type SfCategory = { id: string; nome: string; products: SfProduct[] };
export type SfMenuData = {
  business: { id: string; nome: string; slug: string; logo_url: string | null; aberto_fechado: boolean; categories: SfCategory[] };
};

type StoreRow = { id: string; nome: string; slug: string; logo_url: string | null };
type CatRow = { id: string; name: string; sort_order: number; active: boolean };
type ProdRow = {
  id: string; category_id: string; name: string; description: string | null;
  price_cents: number; image_url: string | null; active: boolean; destaque: boolean; sort_order: number;
};
type GroupRow = { id: string; name: string; required: boolean; max_choices: number | null; sort_order: number };
type AddonRow = { id: string; product_id: string | null; name: string; price_cents: number; active: boolean; group_id: string | null };

const byOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;

/** Adicional vale para o produto se global (product_id null) ou amarrado a ele. */
function aplicaveis(addons: AddonRow[], productId: string): AddonRow[] {
  return addons.filter((a) => a.active && (a.product_id === null || a.product_id === productId));
}

export function mapMenu(input: {
  store: StoreRow; categories: CatRow[]; products: ProdRow[];
  groups: GroupRow[]; addons: AddonRow[]; aberto: boolean;
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
            options: ads
              .filter((a) => a.group_id === g.id)
              .map((a) => ({ id: a.id, nome: a.name, precoExtra: a.price_cents / 100 })),
          }))
          .filter((g) => g.options.length > 0);
        return {
          id: p.id,
          nome: p.name,
          descricao: p.description,
          preco: p.price_cents / 100,
          foto_url: p.image_url,
          destaque: p.destaque,
          optionGroups,
        };
      });
    return { id: c.id, nome: c.name, products: prods };
  });
  return {
    business: { id: store.id, nome: store.nome, slug: store.slug, logo_url: store.logo_url, aberto_fechado: aberto, categories },
  };
}
