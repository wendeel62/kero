// Mapper: WAHA → tipos do componente WhatsAppInbox.

export interface WahaMessage {
  id: string;
  timestamp: number;
  from?: string;
  fromMe: boolean;
  source?: string;
  body?: string | null;
  to?: string | null;
  participant?: string | null;
  hasMedia?: boolean;
  media?: unknown;
  ack?: number;
  ackName?: string | null;
  replyTo?: unknown;
  _data?: unknown;
}

export interface WahaChat {
  id: string;
  name?: string | null;
  picture?: string | null;
  lastMessage?: {
    id?: string;
    timestamp?: number;
    fromMe?: boolean;
    body?: string | null;
    hasMedia?: boolean;
    ackName?: string | null;
  } | null;
}

export interface SimpleMessage {
  id: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
  ack?: number;
}

export interface SimpleChat {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: number;
  unread: number;
}

// WAHA ackName → ack numérico (1 enviado, 2 entregue, 3 lido)
function mapAck(ackName?: string | null): number {
  if (ackName === "SERVER") return 1;
  if (ackName === "DEVICE" || ackName === "READ" || ackName === "PLAYED") return 2;
  if (ackName === "PENDING") return 0;
  return 0;
}

export function mapMessage(m: WahaMessage): SimpleMessage {
  return {
    id: m.id,
    fromMe: m.fromMe,
    body: m.body ?? "",
    timestamp: m.timestamp,
    ack: mapAck(m.ackName),
  };
}

export function mapMessages(messages: WahaMessage[]): SimpleMessage[] {
  return messages.map(mapMessage);
}

export function mapChat(c: WahaChat): SimpleChat {
  return {
    id: c.id,
    name: c.name ?? c.id.replace(/@.*$/, ""),
    lastMessage: c.lastMessage?.body?.trim() || (c.lastMessage?.hasMedia ? "(mídia)" : ""),
    lastMessageAt: c.lastMessage?.timestamp ?? 0,
    unread: 0, // WAHA não expõe contador de não lidas
  };
}

export function mapChats(chats: WahaChat[]): SimpleChat[] {
  return chats.map(mapChat);
}
