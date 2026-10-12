// PDV (recon §3): recálculo de preço no servidor, idêntico ao create_order.
// Mesa ativa = pedido não finalizado (new/confirmed/preparing/ready/out).
export type PdvLine = { id: string; qty: number; addons: string[]; notes?: string };

const NAO_FINALIZADOS = ["new", "confirmed", "preparing", "ready", "out"];

export function pdvTotal(
  lines: PdvLine[],
  products: { id: string; price_cents: number }[],
  addons: { id: string; price_cents: number }[]
): number {
  const price = new Map(products.map((p) => [p.id, p.price_cents]));
  const add = new Map(addons.map((a) => [a.id, a.price_cents]));
  let total = 0;
  for (const l of lines) {
    const base = price.get(l.id);
    if (base === undefined) continue;                 // produto inexistente: ignora
    const unit = base + l.addons.reduce((s, id) => s + (add.get(id) ?? 0), 0);
    total += unit * Math.min(Math.max(l.qty || 1, 1), 20);   // clamp 1..20
  }
  return total;
}

// para cada mesa, o status do pedido ativo (ou null). Uma mesa com pedido
// finalizado/cancelado fica livre.
export function activeTableOrder(
  tables: string[],
  orders: { table_id: string | null; status: string }[]
): (string | null)[] {
  const ativos = new Map<string, string>();
  for (const o of orders) {
    if (o.table_id && NAO_FINALIZADOS.includes(o.status)) ativos.set(o.table_id, o.status);
  }
  return tables.map((t) => ativos.get(t) ?? null);
}
