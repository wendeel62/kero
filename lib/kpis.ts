// KPI entregas em andamento (recon §1): preparing + ready + out.
export function entregasEmAndamento(orders: { status: string }[]): number {
  return orders.filter((o) => o.status === "preparing" || o.status === "ready" || o.status === "out").length;
}
