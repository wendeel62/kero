import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireAdminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// LGPD (SPEC §11): anonimiza pedido — zero dado identificável restante.
// customer_phone é NOT NULL (001) → máscara total "0000000000" (passa no check);
// address vira SÓ {neighborhood_name} (estatísticas); itens/eventos/totais/status intactos.
// Idempotente: já anonimizado = no-op 200.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  const { id } = await params;
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id,customer_name,address,anonymized_at")
    .eq("id", id)
    .maybeSingle();
  if (!order) return apiError("ORDER_NOT_FOUND", "Pedido não encontrado.", 404);
  if (order.anonymized_at)
    return NextResponse.json({ ok: true, anonymized_at: order.anonymized_at });

  const addr = order.address as Record<string, unknown> | null;
  const nb = addr?.["neighborhood_name"];
  const now = new Date().toISOString();
  const { error } = await db
    .from("orders")
    .update({
      customer_name: "Cliente anonimizado",
      customer_phone: "0000000000",
      address: typeof nb === "string" ? { neighborhood_name: nb } : null,
      notes: null,
      anonymized_at: now,
    })
    .eq("id", id);
  if (error) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  return NextResponse.json({ ok: true, anonymized_at: now });
}
