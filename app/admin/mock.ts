// ponytail: mock do admin até Supabase wiring (service role + Auth Admin API).
export type AdminStore = {
  id: string; slug: string; name: string; ownerEmail: string;
  active: boolean; ordersToday: number; createdAt: string;
};

export const ADMIN_STORES: AdminStore[] = [
  { id: "s1", slug: "pizza-do-joao", name: "Pizza do João", ownerEmail: "joao@pizzadojoao.com", active: true, ordersToday: 34, createdAt: "12/01/2026" },
  { id: "s2", slug: "burger-da-praca", name: "Burger da Praça", ownerEmail: "maria@burgerdapraca.com", active: false, ordersToday: 0, createdAt: "28/02/2026" },
];

export function randomPassword(len = 12) {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => abc[n % abc.length]).join("");
}

// pedidos demo p/ tela de detalhe/anonimização — tipo próprio, sem importar do painel
// (PAINEL-09 deleta painel/mock.ts na fase de wiring; admin não pode depender dele)
export type AdminOrder = {
  id: string; code: string; customer: string; minutesAgo: number;
  type: "delivery" | "pickup"; payment: string; total_cents: number;
  status: "new" | "confirmed" | "preparing" | "ready" | "out" | "delivered" | "cancelled";
};

export const ADMIN_ORDERS: AdminOrder[] = [
  { id: "1", code: "K7M2", customer: "Maria", minutesAgo: 12, type: "delivery", payment: "Dinheiro", total_cents: 10480, status: "new" },
  { id: "5", code: "M8VK", customer: "Bia", minutesAgo: 48, type: "delivery", payment: "Dinheiro", total_cents: 7400, status: "out" },
  { id: "6", code: "A1ZZ", customer: "Rafa", minutesAgo: 65, type: "delivery", payment: "Pix", total_cents: 4100, status: "delivered" },
  { id: "7", code: "X2AB", customer: "Leo", minutesAgo: 90, type: "delivery", payment: "Dinheiro", total_cents: 3300, status: "cancelled" },
];
