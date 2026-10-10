// Máquina de estados do pedido (SPEC §6) — espelho TS do trigger 002 (l.163–174).
export type OrderStatus = "new" | "confirmed" | "preparing" | "ready" | "out" | "delivered" | "cancelled";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "new", "confirmed", "preparing", "ready", "out", "delivered", "cancelled",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Novo",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  out: "Saiu p/ entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

// new→confirmed→preparing→(ready|out)→delivered; qualquer estado exceto delivered→cancelled; delivered é final.
const ALLOWED: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "out", "cancelled"],
  ready: ["delivered", "cancelled"],
  out: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from !== to && ALLOWED[from].includes(to);
}

// Avanço do kanban: um clique por etapa; ready e out desembocam em delivered.
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "delivered",
  out: "delivered",
};

export function nextStatus(from: OrderStatus): OrderStatus | null {
  return NEXT[from] ?? null;
}
