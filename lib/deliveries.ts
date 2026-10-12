// Entregas (recon §4, sem mapa): prontas, em rota, concluídas hoje.
// Motoboy "em rota" = rota aberta; assign reusa set_order_status (Trava A).
import { posicaoValida } from "./geocode";

export type Courier = { id: string; name: string; phone: string; active: boolean };

export type MapPoint = { id: string; code: string; lat: number; lng: number; status: string };

export function mapPoints(orders: { id: string; code: string; status: string; address: unknown }[]): MapPoint[] {
  const pts: MapPoint[] = [];
  for (const o of orders) {
    const a = o.address as { lat?: unknown; lng?: unknown } | null;
    if (!a) continue;
    const lat = Number(a.lat);
    const lng = Number(a.lng);
    if (posicaoValida(lat, lng)) pts.push({ id: o.id, code: o.code, lat, lng, status: o.status });
  }
  return pts;
}

export function courierOnRoute(
  couriers: { id: string }[],
  routes: { courier_id: string; status: string }[]
): Set<string> {
  const abertas = new Set(routes.filter((r) => r.status === "open").map((r) => r.courier_id));
  return new Set(couriers.filter((c) => abertas.has(c.id)).map((c) => c.id));
}

export function boardColumns(orders: { status: string }[]): { prontas: number; emRota: number; concluidas: number } {
  const f = (s: string) => orders.filter((o) => o.status === s).length;
  return { prontas: f("ready"), emRota: f("out"), concluidas: f("delivered") };
}
