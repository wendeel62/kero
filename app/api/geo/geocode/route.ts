import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { geocodeAddress, posicaoValida, type GeocodeInput } from "@/lib/geocode";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  }
  if (typeof body !== "object" || body === null) {
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  }
  const b = body as Record<string, unknown>;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";
  const admin = createAdminClient();

  const { data: ipHash } = await admin.rpc("calculate_ip_hash", { p_ip: ip });
  const { count } = await admin
    .from("geocode_log")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("criado_em", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if ((count ?? 0) >= 60) {
    return apiError("RATE_LIMIT", "Muitas buscas de endereço. Aguarde um pouco.", 429);
  }

  await admin.from("geocode_log").insert({ ip_hash: ipHash });

  const street = typeof b.street === "string" ? b.street : undefined;
  const cep = typeof b.cep === "string" ? b.cep : undefined;
  if (!street && !cep) {
    return apiError("INVALID_BODY", "Informe rua ou CEP.", 400);
  }

  const input: GeocodeInput = {
    cep,
    street,
    number: typeof b.number === "string" ? b.number : undefined,
    complement: typeof b.complement === "string" ? b.complement : undefined,
    neighborhood: typeof b.neighborhood === "string" ? b.neighborhood : undefined,
    city: typeof b.city === "string" ? b.city : undefined,
  };

  const result = await geocodeAddress(input);
  if (!result || !posicaoValida(result.lat, result.lng)) {
    return apiError("GEOCODE_FAILED", "Não encontramos o ponto no mapa.", 404);
  }

  return NextResponse.json({ lat: result.lat, lng: result.lng, origem: result.origem });
}
