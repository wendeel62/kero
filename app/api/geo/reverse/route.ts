import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Reverse geocode da vitrine (paridade com GET /api/public/geocode/reverse).
// Botão "usar localização" do checkout: coords → endereço via Nominatim,
// com cache em geocode_cache (arredonda 4 casas). Falha não derruba o checkout.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "coordenadas_invalidas" }, { status: 400 });
  }
  const rlat = Math.round(lat * 1e4) / 1e4;
  const rlng = Math.round(lng * 1e4) / 1e4;
  const admin = createAdminClient();
  const key = `rev:${rlat},${rlng}`;
  const { data: hit } = await admin.from("geocode_cache").select("endereco, falha").eq("query_key", key).single();
  if (hit && !hit.falha && hit.endereco) return NextResponse.json({ endereco: hit.endereco });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${rlat}&lon=${rlng}&format=json`, {
      headers: { "User-Agent": "kero-delivery" },
    });
    if (!res.ok) throw new Error("nominatim");
    const body = (await res.json()) as { display_name?: string };
    if (!body.display_name) throw new Error("sem_endereco");
    await admin.from("geocode_cache").upsert({ query_key: key, lat: rlat, lng: rlng, endereco: body.display_name, falha: false });
    return NextResponse.json({ endereco: body.display_name });
  } catch {
    await admin.from("geocode_cache").upsert({ query_key: key, lat: rlat, lng: rlng, falha: true });
    return NextResponse.json({ error: "geocode_indisponivel" }, { status: 502 });
  }
}
