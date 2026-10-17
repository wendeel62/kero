import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireAdminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Senha provisória de 12 caracteres (mesma política de POST /api/admin/stores).
const PASS_ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const genPassword = () => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => PASS_ABC[b % PASS_ABC.length]).join("");
};

// POST /api/admin/stores/[id]/reset-password — redefine a senha do dono via Auth Admin API.
export async function POST(
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
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!owner) return apiError("OWNER_NOT_FOUND", "Loja sem dono vinculado.", 404);

  const password = genPassword();
  const { error: pwError } = await db.auth.admin.updateUserById(owner.id, { password });
  if (pwError) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);

  return NextResponse.json({ ok: true, password });
}
