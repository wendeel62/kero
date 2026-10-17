import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { desconectar, sessionName } from "@/lib/waha";

// DELETE da sessão WAHA do lojista. POST sem body: desconecta a PRÓPRIA sessão.
export async function POST(_req: Request) {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
  try {
    await desconectar(sessionName(s.storeId));
    return NextResponse.json({ ok: true });
  } catch {
    return apiError("WAHA_ERROR", "Não foi possível desconectar o WhatsApp.", 502);
  }
}
