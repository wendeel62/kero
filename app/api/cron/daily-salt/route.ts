import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

// Cron diário (SPEC §2.22/§2.29): garante o salt do dia + cancela `new` > 24h.
// GET e POST no mesmo handler — o plano manda POST, o Vercel Cron invoca com GET.
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return apiError("UNAUTHORIZED", "Não autorizado.", 401);
  }
  if (process.env.DAILY_SALT_ROTATION_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const admin = createAdminClient();
  const { error: e1 } = await admin.rpc("get_daily_salt");
  if (e1) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  const { data: n, error: e2 } = await admin.rpc("auto_cancel_stale_orders");
  if (e2) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return NextResponse.json({ ok: true, day, auto_cancelled: n ?? 0 });
}

export { run as GET, run as POST };
