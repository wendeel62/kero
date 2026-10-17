import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { listarChats, sessionName } from "@/lib/waha";

// Lista de conversas do inbox (mesma regra do status: sessão vem sempre do
// profile autenticado, nunca do request).
export async function GET() {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
  try {
    const chats = await listarChats(sessionName(s.storeId));
    return NextResponse.json({ chats });
  } catch {
    // WAHA fora / sessão inexistente.
    return apiError("WAHA_ERROR", "Não foi possível consultar o WhatsApp.", 502);
  }
}
