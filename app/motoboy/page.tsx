import { requireCourier } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import MotoboyClient from "./motoboy-client";

type Address = {
  street?: string;
  number?: string;
  complement?: string;
  reference?: string;
  cep?: string;
  neighborhood_name?: string;
  lat?: number;
  lng?: number;
} | null;

export default async function MotoboyPage() {
  const { supabase, courierId, storeId } = await requireCourier();

  const { data: route } = await supabase
    .from("routes")
    .select("id, status")
    .eq("courier_id", courierId)
    .eq("status", "open")
    .maybeSingle();

  const { data: stops } = await supabase
    .from("route_stops")
    .select("id, seq, order_id, orders(address)")
    .eq("route_id", route?.id ?? "")
    .order("seq");

  // ponto fixo da loja (origem): o motoboy não tem RLS de leitura em stores, e a
  // localização da loja já é pública (policy anon_select) — leitura server-side.
  const { data: loja } = await createAdminClient()
    .from("stores")
    .select("lat,lng")
    .eq("id", storeId)
    .single();

  return (
    <MotoboyClient
      courierId={courierId}
      storeId={storeId}
      route={route ? { id: route.id, status: route.status } : null}
      loja={loja && loja.lat != null && loja.lng != null ? { lat: loja.lat, lng: loja.lng } : null}
      stops={(stops ?? []).map((s) => ({
        id: s.id,
        seq: s.seq,
        orderId: s.order_id,
        address: (s.orders as { address?: Address } | null)?.address ?? null,
      }))}
    />
  );
}
