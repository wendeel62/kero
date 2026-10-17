import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { sessionName, statusSessao } from "@/lib/waha";

// Status da sessão WhatsApp do lojista (SPEC §12). Sem body, sem query —
// a sessão vem sempre do profile autenticado.
export async function GET(_req: Request) {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
  try {
    const st = await statusSessao(sessionName(s.storeId));
    // `me` é objeto no GOWS; a página renderiza o número, não o objeto.
    const phone = st.me?.id?.replace(/@.*$/, "") ?? null;
    return NextResponse.json({ status: st.status, phone });
  } catch {
    // WAHA fora / sessão inexistente: o painel trata erro como "Desconectado".
    return apiError("WAHA_ERROR", "Não foi possível consultar o WhatsApp.", 502);
  }
}
