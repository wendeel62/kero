import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { allMessages, sessionName } from "@/lib/waha";

// Mesmo escopo da rota de chats: grupos/broadcast não são exibidos no painel.
const DIRETA = (id: string) =>
  !id.endsWith("@g.us") && !id.endsWith("@broadcast") && !id.endsWith("@newsletter") && id !== "0@c.us";

// Mensagens de uma conversa. O chatId vem do path; a SESSÃO vem sempre do
// profile autenticado — nunca é aceita por query ou body.
export async function GET(_req: Request, { params }: { params: Promise<{ chatId: string }> }) {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
  const { chatId: raw } = await params;
  // Next entrega o segmento dinâmico às vezes cru, às vezes encodado — %40 no
  // id é o caso comum; não vindo encodado não há "%" em ids do WhatsApp.
  let chatId = raw;
  try { chatId = decodeURIComponent(raw); } catch { /* id cru */ }
  if (!chatId) return apiError("INVALID_CHAT", "Conversa inválida.", 400);
  if (!DIRETA(chatId)) return apiError("INVALID_CHAT", "Conversa não exibida no painel.", 400);
  try {
    const messages = await allMessages(sessionName(s.storeId), chatId);
    return NextResponse.json({ messages });
  } catch {
    // WAHA fora / sessão inexistente / conversa inexistente.
    return apiError("WAHA_ERROR", "Não foi possível consultar o WhatsApp.", 502);
  }
}
