// Entregas (recon §4, sem mapa): não finalizadas (ready/out) de qualquer dia
// + concluídas de hoje. Motoboy "em rota" = rota aberta; assign reusa set_order_status (Trava A).
import { distanciaLojaCliente, posicaoValida, type Coords } from "./geocode";

export type Courier = { id: string; name: string; phone: string; active: boolean; vinculado: boolean };

export type MapPoint = { id: string; code: string; lat: number; lng: number; status: string; distKm?: string };

// `loja` = ponto fixo da loja (origem); sem ele o ponto sai sem distância.
export function mapPoints(
  orders: { id: string; code: string; status: string; address: unknown }[],
  loja: Coords | null = null,
): MapPoint[] {
  const pts: MapPoint[] = [];
  for (const o of orders) {
    const a = o.address as { lat?: unknown; lng?: unknown } | null;
    if (!a) continue;
    const lat = Number(a.lat);
    const lng = Number(a.lng);
    if (posicaoValida(lat, lng)) {
      pts.push({ id: o.id, code: o.code, lat, lng, status: o.status, distKm: distanciaLojaCliente(loja, o.address) ?? undefined });
    }
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
