"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mapChats, mapMessages, type SimpleChat, type SimpleMessage } from "@/lib/whatsapp/mappers";

// ---------- Tipos (do mapper) ----------
type Chat = SimpleChat;
type Message = SimpleMessage;

// ---------- Helpers ----------
const hora = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const initials = (name: string) =>
  name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

// ---------- Componente principal ----------
export default function WhatsAppInbox() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = chats.find((c) => c.id === activeId) ?? null;

  const loadChats = useCallback(async () => {
    const r = await fetch("/api/whatsapp/chats");
    if (r.ok) {
      const d = await r.json();
      setChats(mapChats(d.chats ?? []));
    }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(
        `/api/whatsapp/chats/${encodeURIComponent(chatId)}/messages`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (r.ok) {
        const data = await r.json();
        const wahaMsgs = mapMessages(data.messages ?? []);
        wahaMsgs.reverse();
        setMessages((prev) => {
          const wahaIds = new Set(wahaMsgs.map((m) => m.id));
          const localOnly = prev.filter((m) => m.id.startsWith("local_") && !wahaIds.has(m.id));
          return [...wahaMsgs, ...localOnly];
        });
      }
    } catch {
      // silencioso: poll tenta de novo
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  // carrega lista de chats + atualiza a cada 5s
  useEffect(() => {
    loadChats();
    const t = setInterval(loadChats, 5000);
    return () => clearInterval(t);
  }, [loadChats]);

  // carrega mensagens ao trocar de chat + polling
  useEffect(() => {
    setMessages([]);
    if (!activeId) return;
    loadMessages(activeId);
    const t = setInterval(() => loadMessages(activeId), 3000);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  // rola para a última mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setText("");
    // otimista
    setMessages((m) => [
      ...m,
      {
        id: `tmp-${Date.now()}`,
        fromMe: true,
        body,
        timestamp: Math.floor(Date.now() / 1000),
        ack: 0,
      },
    ]);
    await fetch("/api/whatsapp/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: activeId, text: body }),
    });
    setSending(false);
    loadMessages(activeId);
    loadChats();
  }

  const filtered = chats.filter((c) =>
    (c.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      {/* ========== COLUNA ESQUERDA: LISTA DE CHATS ========== */}
      <aside className="flex w-full max-w-[400px] shrink-0 flex-col border-r border-[var(--border)] md:w-[30%] md:min-w-[320px]">
        <header className="flex h-[60px] items-center bg-[var(--surface-2)] px-4">
          <h2 className="text-lg font-bold text-[var(--text)]">Conversas</h2>
        </header>

        <div className="border-b border-[var(--border)] bg-[var(--surface)] p-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar ou começar uma nova conversa"
            className="w-full rounded-xl bg-[var(--surface-2)] px-4 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--text)]"
          />
        </div>

        <ul className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--surface-2)] ${
                  c.id === activeId ? "bg-[var(--surface-2)]" : ""
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-medium text-[var(--muted)] border border-[var(--border)]">
                  {initials(c.name ?? "")}
                </div>
                <div className="min-w-0 flex-1 border-b border-[var(--border)] pb-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-bold text-[var(--text)]">
                      {c.name ?? ""}
                    </span>
                    <span
                      className={`shrink-0 text-xs ${
                        c.unread ? "text-[var(--green)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {c.lastMessageAt ? hora(c.lastMessageAt) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-[var(--muted)]">
                      {c.lastMessage}
                    </span>
                    {c.unread > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--green)] px-1.5 text-xs font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-6 text-center text-sm text-[var(--muted)]">
              Nenhuma conversa encontrada
            </li>
          )}
        </ul>
      </aside>

      {/* ========== COLUNA DIREITA: CONVERSA ========== */}
      <section className="hidden flex-1 flex-col md:flex">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-[var(--surface-2)] text-center">
            <h3 className="text-2xl font-light text-[var(--text)]">
              WhatsApp do seu negócio
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Selecione uma conversa para ver as mensagens.
            </p>
          </div>
        ) : (
          <>
            {/* cabeçalho do chat */}
            <header className="flex h-[60px] items-center gap-3 bg-[var(--surface-2)] px-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-medium text-[var(--muted)] border border-[var(--border)]">
                {initials(active.name ?? "")}
              </div>
              <div className="min-w-0">
                <div className="truncate font-bold text-[var(--text)]">
                  {active.name ?? ""}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {(active.id ?? "").replace("@c.us", "")}
                </div>
              </div>
            </header>

            {/* mensagens */}
            <div className="flex-1 overflow-y-auto bg-[var(--surface-2)] px-[6%] py-4">
              {loadingMsgs && (
                <div className="flex justify-center py-4">
                  <span className="text-sm text-[var(--muted)] animate-pulse">Carregando mensagens…</span>
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div className="flex justify-center py-8">
                  <span className="text-sm text-[var(--muted)]">Sem mensagens nesta conversa.</span>
                </div>
              )}
              <div className="flex flex-col gap-1">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[65%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        m.fromMe
                          ? "bg-[var(--green-soft)] rounded-br-sm"
                          : "bg-[var(--surface)] border border-[var(--border)] rounded-bl-sm"
                      }`}
                    >
                      <span className="whitespace-pre-wrap break-words text-[var(--text)]">
                        {m.body}
                      </span>
                      <span className="ml-2 inline-block translate-y-1 text-[11px] text-[var(--muted)]">
                        {hora(m.timestamp)}
                        {m.fromMe && (
                          <span
                            className={`ml-1 ${
                              m.ack === 3 ? "text-[var(--green)]" : ""
                            }`}
                          >
                            {m.ack && m.ack >= 2 ? "✓✓" : "✓"}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* campo de envio */}
            <footer className="flex items-center gap-2 bg-[var(--surface-2)] px-4 py-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Digite uma mensagem"
                className="flex-1 rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--text)]"
              />
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                className="rounded-xl bg-[var(--text)] hover:bg-[var(--pill-active-bg)] px-5 py-2.5 text-sm font-bold text-white transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
