import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { enviarTexto, sessionName } from "@/lib/waha";

// Envio manual do lojista (o IA continua respondendo por si — sem handoff).
// chatId/text vêm do body; a sessão vem sempre do profile autenticado.
export async function POST(req: Request) {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const { chatId, text } = (body ?? {}) as { chatId?: string; text?: string };
  if (!chatId || typeof text !== "string" || !text.trim()) {
    return apiError("INVALID_MESSAGE", "Mensagem inválida.", 400);
  }
  try {
    const r = await enviarTexto(sessionName(s.storeId), chatId, text);
    return NextResponse.json({ ok: true, id: r?.id ?? null });
  } catch {
    return apiError("WAHA_ERROR", "Não foi possível enviar a mensagem.", 502);
  }
}
