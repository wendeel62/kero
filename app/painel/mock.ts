// ponytail: mock do painel até Supabase wiring (Auth + queries com RLS + Realtime).
export type PanelOrder = {
  id: string; code: string; customer: string; minutesAgo: number;
  type: "delivery" | "pickup"; payment: string; total_cents: number;
  status: "new" | "confirmed" | "preparing" | "ready" | "out" | "delivered" | "cancelled";
};

export const STORE_NAME = "Pizza do João";

export const TODAY_ORDERS: PanelOrder[] = [
  { id: "1", code: "K7M2", customer: "Maria", minutesAgo: 12, type: "delivery", payment: "Dinheiro", total_cents: 10480, status: "new" },
  { id: "2", code: "P4QR", customer: "Ana", minutesAgo: 3, type: "pickup", payment: "Pix", total_cents: 5290, status: "new" },
  { id: "3", code: "T2BN", customer: "Carlos", minutesAgo: 26, type: "delivery", payment: "Maquininha", total_cents: 6840, status: "confirmed" },
  { id: "4", code: "Q9XD", customer: "João", minutesAgo: 32, type: "pickup", payment: "Pix", total_cents: 3890, status: "preparing" },
  { id: "5", code: "M8VK", customer: "Bia", minutesAgo: 48, type: "delivery", payment: "Dinheiro", total_cents: 7400, status: "out" },
  { id: "6", code: "A1ZZ", customer: "Rafa", minutesAgo: 65, type: "delivery", payment: "Pix", total_cents: 4100, status: "delivered" },
  { id: "7", code: "X2AB", customer: "Leo", minutesAgo: 90, type: "delivery", payment: "Dinheiro", total_cents: 3300, status: "cancelled" },
  { id: "8", code: "R3T8", customer: "Lari", minutesAgo: 40, type: "pickup", payment: "Pix", total_cents: 5200, status: "ready" },
];

export const STATUS_PT: Record<PanelOrder["status"], string> = {
  new: "Novo", confirmed: "Confirmado", preparing: "Em preparo",
  ready: "Pronto", out: "Saiu p/ entrega", delivered: "Entregue", cancelled: "Cancelado",
};

export type DetailItem = { name: string; qty: number; unit: number; addons: string[]; notes: string };

// combos demo p/ itens (fase backend: order_items snapshot real)
export const ITEM_SETS: DetailItem[][] = [
  [{ name: "Margherita G", qty: 2, unit: 4990, addons: ["Bacon crocante"], notes: "sem cebola" }, { name: "Coca-Cola 350ml", qty: 1, unit: 690, addons: [], notes: "" }],
  [{ name: "Smash Duplo", qty: 1, unit: 3290, addons: ["Cheddar extra"], notes: "" }],
  [{ name: "Calabresa G", qty: 1, unit: 5290, addons: [], notes: "bem assada" }, { name: "Guaraná 350ml", qty: 2, unit: 650, addons: [], notes: "" }],
];
