import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { requireStoreApi } from "@/lib/auth";
import { qrCode, sessionName } from "@/lib/waha";

// QR em base64 p/ o painel polar a cada 2s. A sessão vem só do profile —
// ninguém lê o QR de outrem.
export async function GET(_req: Request) {
  const s = await requireStoreApi();
  if (!s || !s.storeId) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
  try {
    const qr = await qrCode(sessionName(s.storeId));
    return NextResponse.json({ qr });
  } catch {
    // QR expira (SPEC §12): erro = painel volta ao estado "Desconectado".
    return apiError("WAHA_ERROR", "QR indisponível — gere outro.", 502);
  }
}
