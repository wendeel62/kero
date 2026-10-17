// Cliente WAHA (GOWS). Server-side only: X-Api-Key é segredo.
// ponytail: sem retry — a página do painel reconecta no próximo poll.
if (typeof window !== "undefined") {
  throw new Error("lib/waha.ts é server-side ONLY (X-Api-Key).");
}

function conf() {
  const url = process.env.WAHA_URL;
  const key = process.env.WAHA_API_KEY;
  if (!url || !key) throw new Error("WAHA_URL e WAHA_API_KEY são obrigatórios no .env");
  return { url: url.replace(/\/+$/, ""), key };
}

function headers(json = true): Record<string, string> {
  const { key } = conf();
  const h: Record<string, string> = { "X-Api-Key": key };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// O nome da sessão vem SEMPRE do store_id — nunca do corpo de uma requisição.
export function sessionName(storeId: string): string {
  return `kero_${storeId}`;
}

export async function criarSessao(storeId: string, webhookUrl: string) {
  const { url } = conf();
  const name = sessionName(storeId);
  let res = await fetch(`${url}/api/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name,
      config: {
        // live: engine só aplica dentro de config (na raiz é ignorado).
        engine: { engine: "GOWS" },
        metadata: { store_id: storeId },
        webhooks: [
          { url: webhookUrl, events: ["message"], retries: { policy: "exponential", attempts: 3 } },
        ],
      },
    }),
  });
  // Já existe → cai para o status em vez de falhar (live: 422; 400/409 por garantia).
  if (!res.ok && res.status !== 400 && res.status !== 409 && res.status !== 422) {
    throw await erro(res);
  }
  // Sessão nova nasce STOPPED — só serve QR depois de start. WORKING nunca
  // reinicia (desconectaria o WhatsApp vivo do lojista).
  const s = await statusSessao(name);
  return iniciarSePreciso(name, s);
}

async function iniciarSePreciso(session: string, s: WahaStatus): Promise<WahaStatus> {
  if (s.status === "WORKING") return s;
  const { url } = conf();
  const res = await fetch(`${url}/api/sessions/${session}/start`, {
    method: "POST",
    headers: headers(false),
  });
  if (!res.ok) throw await erro(res);
  return statusSessao(session);
}

// `me` é o contato da sessão autenticada — OBJETO, não string (medido no GOWS:
// {id, pushName, lid, jid, reachoutTimelock, messageCapping}). `id` traz o
// número como "5511999999999@c.us". Antes de 2026-10-17 isso era tipado string e
// o React quebrava ao renderizar o objeto.
export interface WahaMe {
  id: string;
  pushName?: string | null;
}

export interface WahaStatus {
  status: string;
  me: WahaMe | null;
}

export async function statusSessao(session: string): Promise<WahaStatus> {
  const { url } = conf();
  const res = await fetch(`${url}/api/sessions/${session}`, { headers: headers(false) });
  if (!res.ok) throw await erro(res);
  const data = await res.json();
  return { status: data.status, me: data.me ?? null };
}

export async function qrCode(session: string): Promise<string> {
  const { url } = conf();
  // Este WAHA não tem /api/sessions/{s}/auth/qr — QR fica no path clássico (/api/{session}/auth/qr).
  const res = await fetch(`${url}/api/${session}/auth/qr`,
    { headers: { ...headers(), Accept: "application/json" } });
  if (!res.ok) throw await erro(res);
  const data = await res.json();
  return data.data ?? "";
}

export async function enviarTexto(session: string, chatId: string, text: string) {
  const { url } = conf();
  const res = await fetch(`${url}/api/sendText`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ session, chatId, text }),
  });
  if (!res.ok) throw await erro(res);
  return res.json();
}

// Formas MEDIDAS na instância viva (não nas docs do WAHA):
// - GET /api/{session}/chats NÃO tem lastMessage/unreadCount/timestamp — inútil
//   para o inbox. A fonte real da lista é POST chats/overview.
// - Não existe endpoint de avatar nem de marcar-lida (profilePicture/read → 404).
// - timestamp em segundos UNIX; ackName: PENDING/SERVER/DEVICE/READ/PLAYED.

export interface WahaLastMsg {
  id?: string;
  timestamp?: number;
  fromMe?: boolean;
  body?: string | null;
  hasMedia?: boolean;
  ack?: number;
  ackName?: string | null;
}

export interface WahaChat {
  id: string;
  name?: string | null;
  picture?: string | null;
  lastMessage?: WahaLastMsg | null;
}

// Lista do inbox: POST /api/{session}/chats/overview (ordenado já pelo WAHA).
export async function overviewChats(session: string, limit = 30): Promise<WahaChat[]> {
  const { url } = conf();
  const res = await fetch(`${url}/api/${session}/chats/overview`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ pagination: { limit, offset: 0 } }),
  });
  if (!res.ok) throw await erro(res);
  return res.json();
}

// Mensagens de uma conversa, ordem reversa vinda do WAHA (novo → velho).
export interface WahaMessage {
  id: string;
  timestamp: number;
  from?: string;
  fromMe: boolean;
  body?: string | null;
  hasMedia?: boolean;
  ackName?: string | null;
}

export async function allMessages(session: string, chatId: string, limit = 50): Promise<WahaMessage[]> {
  const { url } = conf();
  const res = await fetch(
    `${url}/api/${session}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`,
    { headers: headers(false) },
  );
  if (!res.ok) throw await erro(res);
  return res.json();
}

// O chat de uma mensagem, derivado do id "true/false_<chatId>_<msgId>" — os ids
// de chat nem sempre batem entre /chats (@c.us) e as mensagens (@lid).
export function chatDaMensagem(id: string): string {
  const s = id.replace(/^(true|false)_/, "");
  return s.slice(0, s.lastIndexOf("_"));
}

export async function desconectar(session: string) {
  const { url } = conf();
  const res = await fetch(`${url}/api/sessions/${session}`, { method: "DELETE", headers: headers(false) });
  if (!res.ok) throw await erro(res);
  return true;
}

async function erro(res: Response) {
  const body = await res.text().catch(() => "");
  return new Error(`WAHA ${res.status}: ${body.slice(0, 200)}`);
}
