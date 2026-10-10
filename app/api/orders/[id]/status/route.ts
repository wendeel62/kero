import { NextResponse } from "next/server";

import { apiError, mapStatusError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";

// Transição de status pelo lojista (SPEC §6; kanban M5 usa esta rota).
// Toda a regra — ator, status válido, posse da loja, máquina de estados,
// motivo do cancelamento, colunas imutáveis — vive no RPC set_order_status +
// trigger (002). A rota é transporte: sessão → parse → RPC → map.
// Sempre com o client autenticado do lojista (actor 'store' exige JWT p/
// auth_store_id()), nunca com o admin client.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await requireStoreApi();
  if (!s) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const { status, reason } = (body ?? {}) as { status?: string; reason?: string | null };
  if (typeof status !== "string") return apiError("INVALID_STATUS", "Status inválido.", 400);

  const { id } = await params;
  const { error } = await s.supabase.rpc("set_order_status", {
    p_order_id: id,
    p_to: status,
    p_reason: reason ?? null,
    p_actor: "store",
  });

  if (error) {
    const mapped = mapStatusError(error.message);
    return apiError(mapped.code, mapped.message, mapped.status);
  }
  return NextResponse.json({ ok: true, status });
}
