// Tempo no status ATUAL (design C1: derivado de order_events, nunca gravado).
// Sem evento (pedido ainda em 'new'), o tempo é desde a criação.
export function minutesInStatus(
  events: { to_status: string; created_at: string }[],
  currentStatus: string,
  createdAt: string,
  now: number = Date.now()
): number {
  let reference = createdAt;
  for (const e of events) {
    if (e.to_status === currentStatus && e.created_at > reference) reference = e.created_at;
  }
  return Math.max(0, Math.round((now - new Date(reference).getTime()) / 60_000));
}
