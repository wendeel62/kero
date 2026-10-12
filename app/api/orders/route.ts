import { NextResponse } from "next/server";

import { apiError, mapOrderError } from "@/lib/api-errors";
import { posicaoValida } from "@/lib/geocode";
import { createAdminClient } from "@/lib/supabase/admin";

type OrderBody = {
  store_id?: string;
  customer_name?: string;
  customer_phone?: string;
  type?: string;
  payment_method?: string;
  change_for_cents?: number | null;
  notes?: string | null;
  address?: Record<string, unknown> | null;
  items?: Array<{ id?: string; qty?: number; addons?: string[]; notes?: string | null }>;
  total_cents?: number | null;
  website?: unknown;
};

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
  const b = body as OrderBody;

  // Honeypot (SPEC §9): preenchido = bot — resposta genérica, não revela o anti-bot.
  if (typeof b.website === "string" && b.website !== "") {
    return apiError("HONEYPOT", "Erro no envio. Revise os dados.", 400);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";

  // Coordenada inválida não rejeita o pedido — só remove as chaves (endereço textual continua válido)
  if (b.address && typeof b.address === "object" && "lat" in b.address && "lng" in b.address) {
    const a = b.address as Record<string, unknown>;
    if (!posicaoValida(Number(a.lat), Number(a.lng))) {
      delete a.lat;
      delete a.lng;
    }
  }

  // Toda a regra de negócio vive no RPC create_order (002): rate limit, dedup,
  // horário, bairro, recálculo/preço, mínimo, troco, código, promised_at, ip_hash.
  const { data, error } = await createAdminClient().rpc("create_order", {
    p_store_id: b.store_id ?? null,
    p_type: b.type ?? null,
    p_payment_method: b.payment_method ?? null,
    p_change_for_cents: b.change_for_cents ?? null,
    p_notes: b.notes ?? null,
    p_address: b.address ?? null,
    p_items: Array.isArray(b.items) ? b.items : [],
    p_total_cents: b.total_cents ?? null,
    p_ip: ip,
    p_customer_name: b.customer_name ?? null,
    p_customer_phone: b.customer_phone ?? null,
  });

  if (error) {
    const mapped = mapOrderError(error.message);
    return apiError(mapped.code, mapped.message, mapped.status, mapped.extra);
  }

  return NextResponse.json({ tracking_token: data }, { status: 201 });
}
