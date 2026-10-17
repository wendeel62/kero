import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { overviewChats, sessionName } from "@/lib/waha";

// Escopo do owner: só conversas diretas. Grupos (@g.us) e broadcasts/status
// (0@c.us, @broadcast, @newsletter) saem AQUI no route, não no navegador — o
// overview traz corpos de mensagem de terceiros em grupos e isso não pode
// atravessar a API do painel.
const DIRETA = (id: string) =>
  !id.endsWith("@g.us") && !id.endsWith("@broadcast") && !id.endsWith("@newsletter") && id !== "0@c.us";

// Lista de conversas do inbox (mesma regra do status: sessão vem sempre do
// profile autenticado, nunca do request). Fonte: chats/overview — GET /chats
// não traz lastMessage (medido na instância).
export async function GET() {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
  try {
    const chats = (await overviewChats(sessionName(s.storeId))).filter((c) => DIRETA(c.id));
    return NextResponse.json({ chats });
  } catch {
    // WAHA fora / sessão inexistente.
    return apiError("WAHA_ERROR", "Não foi possível consultar o WhatsApp.", 502);
  }
}
