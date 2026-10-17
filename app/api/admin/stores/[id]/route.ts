import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireAdminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/admin/stores/[id] { active?, force_closed?, plan?, segment?, adesao_paid? }.
// ativa/desativa, fecha/abre à força, troca plano/segmento, marca adesão paga.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as {
    active?: unknown;
    force_closed?: unknown;
    plan?: unknown;
    segment?: unknown;
    adesao_paid?: unknown;
  };
  const hasActive = typeof b.active === "boolean";
  const hasForce = typeof b.force_closed === "boolean";
  const hasPlan = b.plan !== undefined;
  const hasSegment = b.segment !== undefined;
  const hasAdesao = typeof b.adesao_paid === "boolean";
  if (!hasActive && !hasForce && !hasPlan && !hasSegment && !hasAdesao)
    return apiError("INVALID_BODY", "Informe active, force_closed, plan, segment ou adesao_paid.", 400);

  let plan: string | undefined;
  if (hasPlan) {
    if (b.plan !== "basico" && b.plan !== "completo")
      return apiError("INVALID_BODY", "Plano inválido (basico|completo).", 400);
    plan = b.plan;
  }
  let segment: string | null | undefined;
  if (hasSegment) {
    if (b.segment === null) segment = null;
    else if (typeof b.segment === "string") {
      const t = b.segment.trim();
      if (t.length > 40)
        return apiError("INVALID_BODY", "Segmento inválido (máx. 40 caracteres).", 400);
      segment = t ? t : null;
    } else {
      return apiError("INVALID_BODY", "Segmento inválido (máx. 40 caracteres).", 400);
    }
  }

  const db = createAdminClient();
  const { data: store } = await db.from("stores").select("id").eq("id", id).maybeSingle();
  if (!store) return apiError("STORE_NOT_FOUND", "Loja não encontrada.", 404);

  const update: Record<string, unknown> = {};
  if (hasActive) update.active = b.active;
  if (hasForce) {
    update.force_closed = b.force_closed;
    update.force_closed_at = b.force_closed ? new Date().toISOString() : null;
  }
  if (hasPlan) update.plan = plan;
  if (hasSegment) update.segment = segment;
  if (hasAdesao) update.adesao_paid_at = b.adesao_paid ? new Date().toISOString() : null;

  const { data: updated, error } = await db
    .from("stores")
    .update(update)
    .eq("id", id)
    .select("id,active,force_closed,force_closed_at,plan,segment,adesao_paid_at")
    .single();
  if (error) {
    if (error.message.includes("STORE_NOT_CONFIGURED"))
      return apiError(
        "STORE_NOT_CONFIGURED",
        "A loja está mal configurada. Tente mais tarde ou fale com o suporte.",
        409,
      );
    return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  }
  return NextResponse.json({ ok: true, store: updated });
}

// DELETE /api/admin/stores/[id] — apaga a loja, o usuário dono e os arquivos.
// Sem volta: cascade leva produtos, pedidos e demais filhos; o Auth do dono
// é removido junto; logos/fotos no bucket store-assets não têm cascade no banco,
// então são removidos aqui por prefixo (logos/<id>, products/<id>).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  const { id } = await params;
  const db = createAdminClient();

  const { data: store } = await db.from("stores").select("id").eq("id", id).maybeSingle();
  if (!store) return apiError("STORE_NOT_FOUND", "Loja não encontrada.", 404);

  const { data: owner } = await db
    .from("profiles")
    .select("id")
    .eq("store_id", id)
    .eq("role", "loja")
    .maybeSingle();

  const { error: delErr } = await db.from("stores").delete().eq("id", id);
  if (delErr) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);

  // Arquivos da loja no storage (fora do cascade do banco).
  const bucket = db.storage.from("store-assets");
  for (const prefix of [`logos/${id}`, `products/${id}`]) {
    const paths: string[] = [];
    const queue = [prefix];
    while (queue.length > 0) {
      const dir = queue.pop() as string;
      const { data: entries } = await bucket.list(dir, { limit: 100 });
      for (const e of entries ?? []) {
        // sem metadata de arquivo = subpasta (API do storage não diferencia)
        if (!e.metadata || Object.keys(e.metadata).length === 0) queue.push(`${dir}/${e.name}`);
        else paths.push(`${dir}/${e.name}`);
      }
    }
    if (paths.length > 0) await bucket.remove(paths);
  }

  // Perfil cai junto (cascade do auth.users ou set null); remove o login do dono.
  if (owner?.id) {
    const { error: userErr } = await db.auth.admin.deleteUser(owner.id as string);
    if (userErr) return apiError("UNEXPECTED", "Loja apagada, mas falhou ao remover o login do dono.", 500);
  }
  return NextResponse.json({ ok: true });
}
