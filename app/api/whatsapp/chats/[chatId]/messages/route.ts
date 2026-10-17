import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { listarMensagens, sessionName } from "@/lib/waha";

// Mensagens de uma conversa. O chatId vem do path; a SESSÃO vem sempre do
// profile autenticado — nunca é aceita por query ou body.
export async function GET(_req: Request, { params }: { params: Promise<{ chatId: string }> }) {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
  const { chatId } = await params;
  if (!chatId) return apiError("INVALID_CHAT", "Conversa inválida.", 400);
  try {
    const messages = await listarMensagens(sessionName(s.storeId), chatId);
    return NextResponse.json({ messages });
  } catch {
    // WAHA fora / sessão inexistente / conversa inexistente.
    return apiError("WAHA_ERROR", "Não foi possível consultar o WhatsApp.", 502);
  }
}
