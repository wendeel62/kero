// ponytail: mock em código até Supabase wiring; trocar por queries.ts via RLS quando DB existir.
// Única fonte do cardápio demo — vitrine, produto e (futuro) carrinho consomem daqui.
export type Product = { id: string; name: string; description: string; price_cents: number; image_emoji?: string; image_url?: string | null; active: boolean };
export type Addon = { id: string; name: string; price_cents: number };
export type Category = { id: string; name: string; products: Product[] };
export type Store = {
  slug: string; name: string; description: string; logo_url: string | null;
  marquee_text?: string | null; cover_url?: string | null;
  whatsapp: string; min_order_cents: number; prep_time_min: number; prep_time_max: number;
  active: boolean; force_closed: boolean; delivery_fee_cents?: number;
};
export type StoreEntry = { store: Store; categories: Category[]; open: boolean; opensAt: string };
export type Neighborhood = { id: string; name: string; fee_cents: number; active: boolean };

// bairros de entrega da loja demo (spec: taxa por bairro, 0 ativos ⇒ pickup-only)
export const NEIGHBORHOODS: Neighborhood[] = [
  { id: "centro", name: "Centro", fee_cents: 500, active: true },
  { id: "jardins", name: "Jardins", fee_cents: 750, active: true },
  { id: "vila", name: "Vila Nova", fee_cents: 900, active: false },
];

export const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// adicionais globais da loja (spec: product_addons com product_id null)
export const GLOBAL_ADDONS: Addon[] = [
  { id: "bacon", name: "Bacon crocante", price_cents: 600 },
  { id: "cheddar", name: "Cheddar extra", price_cents: 450 },
  { id: "borda", name: "Borda recheada de catupiry", price_cents: 890 },
];

const STORES: Record<string, StoreEntry> = {
  "pizza-do-joao": {
    store: {
      slug: "pizza-do-joao", name: "Pizza do João", description: "Pizzas artesanais em forno a lenha",
      logo_url: null, whatsapp: "5511999998888", min_order_cents: 2500,
      prep_time_min: 30, prep_time_max: 45, active: true, force_closed: false, delivery_fee_cents: 500,
    },
    open: true, opensAt: "11:00",
    categories: [
      {
        id: "pizzas", name: "Pizzas",
        products: [
          { id: "marg-g", name: "Margherita G", description: "Molho de tomate, muçarela, manjericão fresco. Massa de fermentação lenta.", price_cents: 4990, image_emoji: "🍕", active: true },
          { id: "cal-g", name: "Calabresa G", description: "Calabresa, cebola roxa, muçarela.", price_cents: 5290, image_emoji: "🍕", active: true },
          { id: "marg-m", name: "Margherita M", description: "Versão média da clássica.", price_cents: 3990, image_emoji: "🍕", active: true },
          { id: "port-g", name: "Portuguesa G", description: "Presunto, ovo, cebola, ervilha, muçarela.", price_cents: 5490, image_emoji: "🍕", active: true },
          { id: "frango-g", name: "Frango com Catupiry G", description: "Frango desfiado, catupiry, milho.", price_cents: 5590, image_emoji: "🍕", active: true },
          { id: "quatro-g", name: "Quatro Queijos G", description: "Muçarela, parmesão, gorgonzola, catupiry.", price_cents: 5890, image_emoji: "🍕", active: true },
          { id: "pep-g", name: "Pepperoni G", description: "Pepperoni, muçarela, orégano.", price_cents: 5690, image_emoji: "🍕", active: true },
          { id: "veg-g", name: "Vegetariana G", description: "Abobrinha, berinjela, pimentão, muçarela.", price_cents: 5190, image_emoji: "🍕", active: true },
          { id: "choc-g", name: "Chocolate com Morango G", description: "Chocolate ao leite, morangos frescos.", price_cents: 4790, image_emoji: "🍕", active: true },
          { id: "romeu-g", name: "Romeu e Julieta G", description: "Goiabada, queijo minas.", price_cents: 4590, image_emoji: "🍕", active: true },
          { id: "atum-g", name: "Atum G", description: "Atum, cebola, muçarela.", price_cents: 5390, image_emoji: "🍕", active: true },
          { id: "baiana-g", name: "Baiana G", description: "Calabresa moída, pimenta, cebola.", price_cents: 5490, image_emoji: "🍕", active: true },
          { id: "lombo-g", name: "Lombo Canadense G", description: "Lombo, cebola, muçarela.", price_cents: 5590, image_emoji: "🍕", active: true },
          { id: "nap-g", name: "Napolitana G", description: "Muçarela, tomate, parmesão.", price_cents: 5090, image_emoji: "🍕", active: true },
        ],
      },
      {
        id: "burgers", name: "Burgers",
        products: [
          { id: "smash", name: "Smash Duplo", description: "Pão brioche, 2×90g, cheddar, picles.", price_cents: 3290, image_emoji: "🍔", active: true },
          { id: "bacon", name: "Bacon Crispy", description: "Blend 160g, bacon crocante, barbecue.", price_cents: 3590, image_emoji: "🍔", active: true },
        ],
      },
      {
        id: "bebidas", name: "Bebidas",
        products: [
          { id: "coca", name: "Coca-Cola 350ml", description: "Lata gelada.", price_cents: 690, image_emoji: "🥤", active: true },
          { id: "guarana", name: "Guaraná 350ml", description: "Lata gelada.", price_cents: 650, image_emoji: "🥤", active: false },
        ],
      },
    ],
  },
};

export function getEntry(slug: string): StoreEntry | null {
  const e = STORES[slug];
  return e && e.store.active ? e : null;
}

export function findProduct(slug: string, id: string): (StoreEntry & { product: Product; categoryName: string }) | null {
  const e = getEntry(slug);
  if (!e) return null;
  for (const c of e.categories) {
    const p = c.products.find((p) => p.id === id);
    if (p) return { ...e, product: p, categoryName: c.name };
  }
  return null;
}

export type OrderStatus = "new" | "confirmed" | "preparing" | "ready" | "out" | "delivered" | "cancelled";
