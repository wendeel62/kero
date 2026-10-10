import { NextResponse } from "next/server";

import { apiError, mapStatusError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

// Acompanhamento público do pedido (SPEC §12): cliente anônimo com o token.
// RLS fecha orders p/ anon — tudo passa por aqui com service role e volta mascarado.
const maskPhone = (phone: string) => `••••••${phone.slice(-2)}`;
const maskAddress = (address: Record<string, unknown> | null) =>
  (address?.["neighborhood_name"] as string | null) ?? null;

async function findByToken(token: string) {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select("*")
    .eq("tracking_token", token)
    .single();
  return error || !data ? null : data;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = createAdminClient();
  const order = await findByToken(token);
  if (!order) return apiError("ORDER_NOT_FOUND", "Pedido não encontrado.", 404);

  const { data: items } = await db
    .from("order_items")
    .select("name_snapshot,unit_price_cents,qty,addons,notes")
    .eq("order_id", order.id);

  return NextResponse.json({
    code: order.code,
    status: order.status,
    type: order.type,
    customer_name: order.customer_name,
    phone_masked: maskPhone(order.customer_phone),
    neighborhood: maskAddress(order.address),
    notes: order.notes,
    items: (items ?? []).map((i) => ({
      name: i.name_snapshot,
      qty: i.qty,
      unit_price_cents: i.unit_price_cents,
      addons: i.addons ?? [],
      notes: i.notes,
    })),
    subtotal_cents: order.subtotal_cents,
    delivery_fee_cents: order.delivery_fee_cents,
    total_cents: order.total_cents,
    payment_method: order.payment_method,
    change_for_cents: order.change_for_cents,
    promised_at: order.promised_at,
    created_at: order.created_at,
    canCancel: order.status === "new" || order.status === "confirmed",
    cancellation_reason: order.cancellation_reason,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const { reason } = (body ?? {}) as { reason?: string | null };

  const order = await findByToken(token);
  if (!order) return apiError("ORDER_NOT_FOUND", "Pedido não encontrado.", 404);
  if (order.status !== "new" && order.status !== "confirmed") {
    return apiError(
      "CANCEL_NOT_ALLOWED",
      "Cancelamento disponível só em pedidos novos ou confirmados.",
      400,
    );
  }

  const { error } = await createAdminClient().rpc("set_order_status", {
    p_order_id: order.id,
    p_to: "cancelled",
    p_reason: reason ?? null,
    p_actor: "customer",
  });
  if (error) {
    const mapped = mapStatusError(error.message);
    return apiError(mapped.code, mapped.message, mapped.status);
  }
  return NextResponse.json({ ok: true, status: "cancelled" });
}
