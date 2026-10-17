import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { criarSessao, sessionName } from "@/lib/waha";

// Cria/reconecta a sessão WAHA do lojista. POST sem body: o store_id é sempre
// do profile e o webhook do n8n é sempre da env — nada vem da requisição.
export async function POST(_req: Request) {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
  const webhook = process.env.WHATSAPP_WEBHOOK_URL;
  if (!webhook) {
    return apiError(
      "WHATSAPP_NOT_CONFIGURED",
      "Integração do WhatsApp não configurada.",
      503,
    );
  }
  try {
    const st = await criarSessao(s.storeId, webhook);
    return NextResponse.json({ status: st.status, phone: st.me });
  } catch {
    return apiError("WAHA_ERROR", "Não foi possível conectar o WhatsApp.", 502);
  }
}
