import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireAdminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const KEYS = ["plan_basico", "plan_completo", "adesao_fee", "ad_spend_daily"] as const;
type SettingsKey = (typeof KEYS)[number];

async function readSettings(db: ReturnType<typeof createAdminClient>) {
  const { data, error } = await db.from("saas_settings").select("key, value");
  if (error) return null;
  const settings: Record<SettingsKey, number> = {
    plan_basico: 0,
    plan_completo: 0,
    adesao_fee: 0,
    ad_spend_daily: 0,
  };
  for (const row of data ?? []) {
    if ((KEYS as readonly string[]).includes(row.key)) {
      settings[row.key as SettingsKey] = Number(row.value);
    }
  }
  return settings;
}

export async function GET() {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  const settings = await readSettings(createAdminClient());
  if (!settings) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as {
    key?: unknown;
    value?: unknown;
  };
  if (typeof b.key !== "string" || !(KEYS as readonly string[]).includes(b.key))
    return apiError("INVALID_KEY", "Chave de configuração inválida.", 400);
  const value = typeof b.value === "string" ? Number(b.value) : b.value;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return apiError("INVALID_VALUE", "Valor inválido (número ≥ 0).", 400);

  const db = createAdminClient();
  const { error } = await db
    .from("saas_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", b.key);
  if (error) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);

  const settings = await readSettings(db);
  if (!settings) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  return NextResponse.json({ ok: true, settings });
}
