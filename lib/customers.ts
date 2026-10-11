// Clientes derivados de orders (design D3): sem tabela, sem sincronizacao.
// Mesmos limiares do cardapio-digital (customers.ts:7-16), em centavos.
export type CustomerProfile = "vip" | "recorrente" | "novo";
export const LIMITE_VIP_PEDIDOS = 5;
export const LIMITE_VIP_GASTO_CENTS = 50_000; // R$ 500,00

export function classifyCustomer(orders: number, spentCents: number): CustomerProfile {
  if (orders > LIMITE_VIP_PEDIDOS || spentCents >= LIMITE_VIP_GASTO_CENTS) return "vip";
  if (orders > 1) return "recorrente";
  return "novo";
}

export type Customer = {
  phone: string; name: string; orders: number;
  spentCents: number; lastOrderAt: string; profile: CustomerProfile;
};

export function aggregateCustomers(
  rows: { customer_name: string; customer_phone: string; total_cents: number; status: string; created_at: string }[]
): Customer[] {
  const byPhone = new Map<string, { name: string; lastAt: string; orders: number; spent: number }>();
  for (const r of rows) {
    const cur = byPhone.get(r.customer_phone) ?? { name: r.customer_name, lastAt: r.created_at, orders: 0, spent: 0 };
    if (r.created_at > cur.lastAt) { cur.lastAt = r.created_at; cur.name = r.customer_name; }
    if (r.status !== "cancelled") { cur.orders += 1; cur.spent += r.total_cents; }
    byPhone.set(r.customer_phone, cur);
  }
  return [...byPhone.entries()]
    .map(([phone, v]) => ({
      phone, name: v.name, orders: v.orders, spentCents: v.spent,
      lastOrderAt: v.lastAt, profile: classifyCustomer(v.orders, v.spent),
    }))
    .sort((a, b) => b.spentCents - a.spentCents);
}
