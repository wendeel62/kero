"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Três estados, e só três: desconectado / conectando (QR) / conectado.
type Estado = "carregando" | "desconectado" | "conectando" | "conectado";

// Vocabulário do WAHA (lib/waha.ts).
const LABEL: Record<string, string> = {
  WORKING: "Conectado",
  SCAN_QR_CODE: "Aguardando leitura do QR",
  STARTING: "Iniciando sessão…",
  FAILED: "A conexão falhou",
  STOPPED: "Sessão parada",
  PASSKEY_REQUIRED: "Verificação necessária no celular",
};

// Formas das respostas de /api/whatsapp/chats e .../messages (ver lib/waha.ts).
type Chat = {
  id: string;
  name?: string | null;
  timestamp: number;
  unreadCount?: number;
  lastMessage?: { body?: string | null; fromMe?: boolean } | null;
};
type Msg = { id: string; timestamp: number; fromMe: boolean; body?: string | null };

// WAHA dá timestamp em segundos UNIX — sempre *1000 antes de formatar.
const tempoRelativo = (ts: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
};
const hora = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function WhatsApp() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [wahaStatus, setWahaStatus] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  // Inbox — só vive no estado "conectado". Sem handoff: o IA segue respondendo,
  // o lojista só manda mensagem manual por cima.
  const [chats, setChats] = useState<Chat[]>([]);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [inboxErro, setInboxErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const r = await fetch("/api/whatsapp/status");
      if (!r.ok) { setEstado("desconectado"); return; } // WAHA fora = desconectado
      const d = await r.json(); // { status, phone }
      setWahaStatus(d.status);
      setPhone(d.phone);
      setEstado(d.status === "WORKING" ? "conectado" : "desconectado");
    } catch {
      setEstado("desconectado");
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Poll enquanto conecta: status a cada 2s e, se ainda não conectou, o QR.
  // Erro no poll (QR expirado, WAHA caiu) → volta ao estado desconectado.
  useEffect(() => {
    if (estado !== "conectando") return;
    const tick = async () => {
      try {
        const rs = await fetch("/api/whatsapp/status");
        if (!rs.ok) throw new Error("status indisponível");
        const s = await rs.json();
        if (s.status === "WORKING") {
          setWahaStatus("WORKING");
          setPhone(s.phone);
          setEstado("conectado");
          return;
        }
        if (s.status === "FAILED" || s.status === "STOPPED" || s.status === "PASSKEY_REQUIRED") {
          setWahaStatus(s.status);
          setQr(null);
          setEstado("desconectado");
          return;
        }
        const rq = await fetch("/api/whatsapp/qr");
        if (!rq.ok) throw new Error("QR expirou");
        const q = await rq.json();
        setQr(q.qr);
      } catch {
        setWahaStatus("");
        setQr(null);
        setErro("O QR ficou indisponível — tente conectar de novo.");
        setEstado("desconectado");
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [estado]);

  // Poll de conversas enquanto conectado. Param no unmount ou ao desconectar.
  const carregarChats = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/chats");
      if (r.ok) setChats((await r.json()).chats ?? []);
    } catch {
      /* silencioso: o próximo poll tenta de novo */
    }
  }, []);
  useEffect(() => {
    if (estado !== "conectado") return;
    carregarChats();
    const id = setInterval(carregarChats, 4000);
    return () => clearInterval(id);
  }, [estado, carregarChats]);

  // Poll das mensagens da conversa aberta. Param no unmount ou ao trocar de chat.
  const carregarMsgs = useCallback(async (chatId: string) => {
    try {
      const r = await fetch(`/api/whatsapp/chats/${encodeURIComponent(chatId)}/messages`);
      if (!r.ok) return;
      const d = await r.json();
      // WAHA já manda em ordem ascendente; o sort é só garantia.
      setMsgs(((d.messages ?? []) as Msg[]).slice().sort((a, b) => a.timestamp - b.timestamp));
    } catch {
      /* silencioso: o próximo poll tenta de novo */
    }
  }, []);
  useEffect(() => {
    setMsgs([]);
    if (!ativo || estado !== "conectado") return;
    carregarMsgs(ativo);
    const id = setInterval(() => carregarMsgs(ativo), 4000);
    return () => clearInterval(id);
  }, [ativo, estado, carregarMsgs]);
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  async function enviarMsg(e: React.FormEvent) {
    e.preventDefault();
    if (!ativo || !texto.trim()) return;
    setEnviando(true);
    setInboxErro("");
    const corpo = texto;
    setTexto("");
    try {
      const r = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: ativo, text: corpo }),
      });
      if (!r.ok) {
        setInboxErro("Não foi possível enviar. Tente de novo.");
      } else {
        // Eco otimista: o próximo poll substitui pelo registro oficial do WAHA.
        setMsgs((prev) => [
          ...prev,
          { id: `local_${Date.now()}`, timestamp: Math.floor(Date.now() / 1000), fromMe: true, body: corpo },
        ]);
      }
    } catch {
      setInboxErro("Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function conectar() {
    setBusy(true);
    setErro("");
    try {
      const r = await fetch("/api/whatsapp/connect", { method: "POST" });
      if (!r.ok) { setErro("Não foi possível conectar o WhatsApp. Tente de novo."); return; }
      const d = await r.json();
      setWahaStatus(d.status);
      setPhone(d.phone);
      setEstado(d.status === "WORKING" ? "conectado" : "conectando");
    } catch {
      setErro("Não foi possível conectar o WhatsApp. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function desconectar() {
    setBusy(true);
    setErro("");
    try {
      const r = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      if (!r.ok) { setErro("Não foi possível desconectar o WhatsApp. Tente de novo."); return; }
      setWahaStatus("");
      setPhone(null);
      setQr(null);
      setChats([]);
      setAtivo(null);
      setEstado("desconectado");    } catch {
      setErro("Não foi possível desconectar o WhatsApp. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (estado === "carregando") {
    return (
      <main className="admin-content">
        <p className="text-sm text-[var(--muted)] animate-pulse">Carregando WhatsApp…</p>
      </main>
    );
  }

  const dataUrl = qr ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`) : null;

  return (
    <main className="admin-content">
      <p className="text-xs text-[var(--muted)] anim-rise">assistente de WhatsApp com IA (pt-BR)</p>

      {erro && (
        <p className="mt-3 text-sm font-bold text-[var(--red)] bg-[var(--red-soft)] border border-[var(--border)] rounded-2xl px-4 py-3 anim-pop" role="alert">
          {erro}
        </p>
      )}

      {estado === "desconectado" && (
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--muted)]" aria-hidden />
            <h2 className="font-extrabold">Desconectado</h2>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)] max-w-md">
            Conecte o WhatsApp da sua loja e a atendente de IA responde seus clientes
            no zap — 24h por dia, em português. Você escaneia o QR uma vez e pronto.
          </p>
          {wahaStatus && wahaStatus !== "SCAN_QR_CODE" && wahaStatus !== "STARTING" && (
            <p className="mt-3 text-xs font-bold text-[var(--red)] bg-[var(--red-soft)] border border-[var(--border)] rounded-xl px-3 py-2" role="alert">
              {LABEL[wahaStatus] ?? wahaStatus}. Tente conectar de novo.
            </p>
          )}
          <button onClick={conectar} disabled={busy}
            className="mt-4 w-full sm:w-auto bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99] disabled:opacity-50">
            {busy ? "Conectando…" : "Conectar WhatsApp"}
          </button>
        </section>
      )}

      {estado === "conectando" && (
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5 self-start">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--amber)] animate-pulse" aria-hidden />
            <h2 className="font-extrabold">Conectando…</h2>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)] self-start max-w-md">
            Abra o WhatsApp no seu celular → Aparelhos conectados → Conectar aparelho,
            e aponte a câmera para o QR abaixo.
          </p>
          {dataUrl ? (
            <img src={dataUrl} alt="QR code do WhatsApp para escanear com o celular" className="mt-4 w-full max-w-64 aspect-square rounded-xl border border-[var(--border)]" />
          ) : (
            <div className="mt-4 w-full max-w-64 aspect-square rounded-xl border border-[var(--border)] bg-[var(--surface-2)] animate-pulse" aria-label="Carregando QR code" />
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">O QR expira rápido e atualiza sozinho.</p>
        </section>
      )}

      {estado === "conectado" && (
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm p-4 sm:p-6 anim-rise">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--green)]" aria-hidden />
            <h2 className="font-extrabold">Conectado</h2>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-[var(--muted)]">Número</dt>
              {/* WAHA pode não informar o número em todas as sessões */}
              <dd className="font-extrabold tabular-nums">{phone ?? "não informado"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-[var(--muted)]">Status</dt>
              <dd className="font-extrabold">{LABEL[wahaStatus] ?? wahaStatus}</dd>
            </div>
          </dl>
          <button onClick={desconectar} disabled={busy}
            className="mt-4 w-full sm:w-auto bg-[var(--red)] text-white font-extrabold rounded-2xl px-8 py-3 transition-all active:scale-[0.99] disabled:opacity-50">
            {busy ? "Desconectando…" : "Desconectar"}
          </button>
        </section>
      )}

      {estado === "conectado" && (
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm anim-rise overflow-hidden">
          {/* Mobile: mostra a lista primeiro; abrir conversa troca para a thread. */}
          <div className="md:grid md:grid-cols-[280px_1fr] md:h-[68vh]">
            <aside
              className={`${ativo ? "hidden" : "block"} md:block md:h-full h-[60vh] overflow-y-auto divide-y divide-[var(--border)] border-r border-[var(--border)]`}
              aria-label="Conversas"
            >
              {chats.length === 0 ? (
                <div className="h-full flex items-center justify-center px-6 text-center">
                  <p className="text-sm text-[var(--muted)]">
                    Nenhuma conversa ainda. Quando um cliente mandar mensagem no zap, ela aparece aqui.
                  </p>
                </div>
              ) : (
                chats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setAtivo(c.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${c.id === ativo ? "bg-[var(--surface-2)]" : ""}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-extrabold truncate">{c.name?.trim() || c.id.replace(/@.*$/, "")}</span>
                      <time className="text-xs text-[var(--muted)] shrink-0" dateTime={new Date(c.timestamp * 1000).toISOString()}>
                        {tempoRelativo(c.timestamp)}
                      </time>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-sm text-[var(--muted)] truncate">
                        {c.lastMessage?.fromMe ? "Você: " : ""}
                        {c.lastMessage?.body?.trim() || "(mídia)"}
                      </p>
                      {(c.unreadCount ?? 0) > 0 && (
                        <span className="shrink-0 bg-[var(--green)] text-white text-xs font-extrabold rounded-full min-w-5 h-5 grid place-items-center px-1.5 tabular-nums">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </aside>

            <div className={`${ativo ? "flex" : "hidden"} md:flex flex-col md:h-full h-[80vh]`}>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)]">
                <button
                  onClick={() => setAtivo(null)}
                  className="md:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--surface-2)] text-lg"
                  aria-label="Voltar às conversas"
                >
                  ←
                </button>
                <span className="font-extrabold truncate">
                  {chats.find((c) => c.id === ativo)?.name?.trim() || ativo?.replace(/@.*$/, "") || ""}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--surface-2)]" aria-label="Mensagens">
                {msgs.length === 0 ? (
                  <p className="h-full grid place-items-center text-sm text-[var(--muted)] text-center px-6">
                    Sem mensagens nesta conversa.
                  </p>
                ) : (
                  msgs.map((m) => (
                    <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                          m.fromMe
                            ? "bg-[var(--green-soft)] rounded-br-sm"
                            : "bg-[var(--surface)] border border-[var(--border)] rounded-bl-sm"
                        }`}
                      >
                        <p>{m.body?.trim() ? m.body : "(mídia)"}</p>
                        <time className="block text-right text-[10px] text-[var(--muted)] tabular-nums">
                          {hora(m.timestamp)}
                        </time>
                      </div>
                    </div>
                  ))
                )}
                <div ref={fimRef} />
              </div>

              {inboxErro && (
                <p className="mx-3 mt-2 text-xs font-bold text-[var(--red)] bg-[var(--red-soft)] border border-[var(--border)] rounded-xl px-3 py-2" role="alert">
                  {inboxErro}
                </p>
              )}

              <form onSubmit={enviarMsg} className="flex gap-2 p-3 border-t border-[var(--border)]">
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  disabled={!ativo || enviando}
                  placeholder="Escreva uma mensagem…"
                  aria-label="Mensagem"
                  className="flex-1 min-w-0 bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-[var(--text)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!ativo || enviando || !texto.trim()}
                  className="shrink-0 bg-[var(--text)] hover:bg-[var(--pill-active-bg)] text-white font-extrabold rounded-2xl px-5 py-2.5 text-sm transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
