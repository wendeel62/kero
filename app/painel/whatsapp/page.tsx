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

// Formas MEDIDAS na instância viva (ver lib/waha.ts — a lista vem do
// chats/overview; não existe unreadCount nem endpoint de marcar-lida).
type Ultima = {
  id?: string;
  timestamp?: number;
  fromMe?: boolean;
  body?: string | null;
  hasMedia?: boolean;
  ackName?: string | null;
};
type Chat = { id: string; name?: string | null; picture?: string | null; lastMessage?: Ultima | null };
type Msg = { id: string; timestamp: number; fromMe: boolean; body?: string | null; hasMedia?: boolean; ackName?: string | null };

// WAHA dá timestamp em segundos UNIX — sempre *1000 antes de formatar.
const hora = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Rótulo de separador de dia: Hoje / Ontem / nome do dia / dd/mm/aaaa (WhatsApp Web).
function rotuloDia(ts: number): string {
  const dias = diasAtras(ts);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return new Date(ts * 1000).toLocaleDateString("pt-BR", { weekday: "long" });
  return new Date(ts * 1000).toLocaleDateString("pt-BR");
}
function diasAtras(ts: number): number {
  const d = new Date(ts * 1000);
  d.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((hoje.getTime() - d.getTime()) / 86400000);
}
// Hora na lista de conversas (WhatsApp Web): HH:MM hoje, "Ontem", "qua." na semana, dd/mm/aaaa.
function horaLista(ts: number): string {
  const dias = diasAtras(ts);
  if (dias === 0) return hora(ts);
  if (dias === 1) return "Ontem";
  if (dias < 7) return new Date(ts * 1000).toLocaleDateString("pt-BR", { weekday: "short" });
  return new Date(ts * 1000).toLocaleDateString("pt-BR");
}

// Confirmo de leitura no balão de saída: ✓ SERVER, ✓✓ DEVICE/READ/PLAYED.
const ticks = (ackName?: string | null) => {
  if (ackName === "SERVER") return "✓";
  if (ackName === "DEVICE" || ackName === "READ" || ackName === "PLAYED") return "✓✓";
  return "";
};
const previewTicks = (u: Ultima | null | undefined) => (u?.fromMe ? `${ticks(u.ackName)} ` : "");

// Avatar sem foto: iniciais sobre cor estável derivada do id do chat.
function corAvatar(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 40%)`;
}
function iniciais(c: Chat) {
  const n = c.name?.trim();
  return n ? n.slice(0, 2) : c.id.replace(/@.*$/, "").slice(0, 2);
}
function Avatar({ chat, className = "w-12 h-12" }: { chat: Chat; className?: string }) {
  return chat.picture ? (
    <img src={chat.picture} alt={`Foto de ${chat.name?.trim() || chat.id.replace(/@.*$/, "")}`}
      className={`${className} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${className} shrink-0 rounded-full grid place-items-center text-white font-extrabold`}
      style={{ backgroundColor: corAvatar(chat.id) }} aria-hidden>
      {iniciais(chat)}
    </span>
  );
}

// Filtro cliente-side da lista: busca por nome/texto + pílulas (grupos nunca
// vêm da rota — o empty state é proposital).
function filtraChats(
  chats: Chat[],
  filtro: "todo" | "nao-lidas" | "grupos",
  busca: string,
  naoLidas: Record<string, number>,
): Chat[] {
  const q = busca.trim().toLowerCase();
  return chats.filter((c) => {
    if (filtro === "nao-lidas" && !(naoLidas[c.id] > 0)) return false;
    if (!q) return true;
    return (c.name ?? "").toLowerCase().includes(q) || (c.lastMessage?.body ?? "").toLowerCase().includes(q);
  });
}

// Lista de mensagens com separadores de dia (assinatura do WhatsApp Web).
function ListaMensagens({ msgs }: { msgs: Msg[] }) {
  let diaAnterior = "";
  return (
    <>
      {msgs.map((m) => {
        const dia = rotuloDia(m.timestamp);
        const separador = dia !== diaAnterior;
        diaAnterior = dia;
        const corpo = m.body?.trim();
        return (
          <div key={m.id}>
            {separador && (
              <div className="flex justify-center my-3 sticky top-1">
                <span className="text-xs font-bold bg-[var(--surface)] text-[var(--muted)] rounded-xl px-3 py-1 shadow-sm border border-[var(--border)]">
                  {dia}
                </span>
              </div>
            )}
            <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"} mb-1.5`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  m.fromMe
                    ? "bg-[var(--green-soft)] rounded-br-sm"
                    : "bg-[var(--surface)] border border-[var(--border)] rounded-bl-sm"
                }`}
              >
                {/* corpo vazio com mídia: nunca renderizar balão vazio */}
                <p>{corpo || (m.hasMedia ? "(mídia)" : "")}</p>
                <span className="float-right mt-1 ml-3 text-[10px] text-[var(--muted)] tabular-nums flex items-center gap-0.5">
                  {hora(m.timestamp)}
                  {m.fromMe && <span className="text-[var(--green)]">{ticks(m.ackName)}</span>}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

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

  // Busca + filtros (Todo / Não lidas / Grupos).
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todo" | "nao-lidas" | "grupos">("todo");

  // Não lidas: calculadas no cliente — este WAHA não tem contador nem
  // endpoint de marcar-lida (404). Guardo chatId → {ts, msgId, count} em
  // localStorage; abrir a conversa zera. ponytail: "count" conta mensagens
  // NOVAS observadas entre polls (aproximação), upgrade quando o WAHA expõe
  // um contador real.
  const [naoLidas, setNaoLidas] = useState<Record<string, number>>({});
  const lerRef = useRef<Record<string, { ts: number; msgId: string; count: number }>>({});
  const guardarLeituras = () => {
    try { localStorage.setItem("waha_leituras", JSON.stringify(lerRef.current)); } catch { /* sem storage */ }
  };

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
  useEffect(() => {
    try { lerRef.current = JSON.parse(localStorage.getItem("waha_leituras") ?? "{}"); } catch { /* sem storage */ }
    carregar();
  }, [carregar]);

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

  // Poll de conversas enquanto conectado. Param no unmount, ao desconectar ou
  // ao trocar de chat (carregarChats depende de ativo — recria com limpeza).
  const carregarChats = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/chats");
      if (!r.ok) return;
      const frescas = ((await r.json()).chats ?? []) as Chat[];
      setChats(frescas);
      // Recontagem de não lidas sobre este snapshot.
      const lidos = lerRef.current;
      const nl: Record<string, number> = {};
      for (const c of frescas) {
        const last = c.lastMessage;
        if (!last || last.timestamp == null) continue;
        const e = (lidos[c.id] ??= { ts: 0, msgId: "", count: 0 });
        const aberta = c.id === ativo;
        // Primeira observação vira baseline: nada fica "atrasado" no 1º load.
        if (!e.ts) { e.ts = last.timestamp; e.msgId = last.id ?? ""; continue; }
        if (last.timestamp > e.ts) {
          if (last.fromMe || aberta) {
            e.count = 0; // minhã própria/vista = em dia
          } else if (last.id !== e.msgId) {
            e.count += 1;
          }
          e.ts = last.timestamp;
          e.msgId = last.id ?? "";
        }
        if (e.count > 0) nl[c.id] = e.count;
      }
      guardarLeituras();
      setNaoLidas(nl);
    } catch {
      /* silencioso: o próximo poll tenta de novo */
    }
  }, [ativo]);
  useEffect(() => {
    if (estado !== "conectado") return;
    carregarChats();
    const id = setInterval(carregarChats, 4000);
    return () => clearInterval(id);
  }, [estado, carregarChats]);

  function abrirChat(id: string) {
    setAtivo(id);
    const e = lerRef.current[id];
    if (e) e.count = 0;
    guardarLeituras();
    setNaoLidas((nl) => ({ ...nl, [id]: 0 }));
  }

  // Poll das mensagens da conversa aberta. Param no unmount ou ao trocar de chat.
  const carregarMsgs = useCallback(async (chatId: string) => {
    try {
      const r = await fetch(`/api/whatsapp/chats/${encodeURIComponent(chatId)}/messages`);
      if (!r.ok) return;
      const d = await r.json();
      // WAHA manda em ordem REVERSA (novo → velho); inverter preserva empates.
      setMsgs(((d.messages ?? []) as Msg[]).slice().reverse());
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
        setTexto(corpo); // devolve o texto: a borrada só foi na mensagem enviada
      } else {
        // Eco otimista: o próximo poll substitui pelo registro oficial do WAHA.
        setMsgs((prev) => [
          ...prev,
          { id: `local_${Date.now()}`, timestamp: Math.floor(Date.now() / 1000), fromMe: true, body: corpo },
        ]);
      }
    } catch {
      setInboxErro("Não foi possível enviar. Tente de novo.");
      setTexto(corpo);
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
  const chatAtivo = chats.find((c) => c.id === ativo);

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
          <div className="md:grid md:grid-cols-[320px_1fr] md:h-[70vh]">
            {/* Lista de conversas (Whatsapp Web esquerda). Mobile: visível quando
                nenhuma conversa aberta; a thread toma a tela inteira. */}
            <aside
              className={`${ativo ? "hidden" : "flex flex-col"} md:flex md:h-full h-[70vh] border-r border-[var(--border)]`}
              aria-label="Conversas"
            >
              <div className="p-3 border-b border-[var(--border)]">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar ou começar uma nova conversa"
                  aria-label="Pesquisar conversa"
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl px-4 py-2 text-sm outline-none focus:border-[var(--text)]"
                />
                <div className="flex gap-1.5 mt-2" role="group" aria-label="Filtros">
                  {([["todo", "Todo"], ["nao-lidas", "Não lidas"], ["grupos", "Grupos"]] as const).map(([v, t]) => (
                    <button key={v} onClick={() => setFiltro(v)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        filtro === v
                          ? "bg-[var(--pill-active-bg)] text-white border-transparent font-extrabold"
                          : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
                      }`}
                      aria-pressed={filtro === v}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                {filtraChats(chats, filtro, busca, naoLidas).length === 0 ? (
                  <div className="h-full flex items-center justify-center px-6 text-center">
                    <p className="text-sm text-[var(--muted)]">
                      {filtro === "grupos"
                        ? "Os grupos não são exibidos no painel — só conversas diretas com clientes."
                        : filtro === "nao-lidas"
                          ? "Nenhuma conversa não lida."
                          : busca
                            ? "Nada encontrado para esta busca."
                            : "Nenhuma conversa ainda. Quando um cliente mandar mensagem no zap, ela aparece aqui."}
                    </p>
                  </div>
                ) : (
                  filtraChats(chats, filtro, busca, naoLidas).map((c) => {
                    const nome = c.name?.trim() || c.id.replace(/@.*$/, "");
                    const u = c.lastMessage;
                    const nl = naoLidas[c.id] ?? 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => abrirChat(c.id)}
                        aria-current={c.id === ativo ? "true" : undefined}
                        className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-[var(--surface-2)] transition-colors ${c.id === ativo ? "bg-[var(--surface-2)]" : ""}`}
                      >
                        <Avatar chat={c} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-extrabold truncate">{nome}</span>
                            {u?.timestamp != null && (
                              <time className="text-xs text-[var(--muted)] shrink-0" dateTime={new Date(u.timestamp * 1000).toISOString()}>
                                {horaLista(u.timestamp)}
                              </time>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-sm text-[var(--muted)] truncate">
                              {u ? `${previewTicks(u)}${u.body?.trim() || (u.hasMedia ? "(mídia)" : "")}` : ""}
                            </p>
                            {nl > 0 && (
                              <span className="shrink-0 bg-[var(--green)] text-white text-xs font-extrabold rounded-full min-w-5 h-5 grid place-items-center px-1.5 tabular-nums"
                                aria-label={`${nl} mensagens não lidas`}>
                                {nl}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Thread (Whatsapp Web direita). Mobile: tela cheia com voltar. */}
            <div className={`${ativo ? "flex" : "hidden"} md:flex flex-col md:h-full h-[70vh]`}>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
                <button
                  onClick={() => setAtivo(null)}
                  className="md:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--surface-2)] text-lg"
                  aria-label="Voltar às conversas"
                >
                  ←
                </button>
                <Avatar chat={chatAtivo ?? { id: ativo ?? "" }} className="w-10 h-10" />
                <div className="min-w-0">
                  <p className="font-extrabold truncate leading-tight">
                    {chatAtivo?.name?.trim() || chatAtivo?.id.replace(/@.*$/, "") || ""}
                  </p>
                  <p className="text-xs text-[var(--muted)] tabular-nums leading-tight">
                    {chatAtivo?.id.replace(/@.*$/, "")}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 bg-[var(--surface-2)]" aria-label="Mensagens">
                {msgs.length === 0 ? (
                  <p className="h-full grid place-items-center text-sm text-[var(--muted)] text-center px-6">
                    {chatAtivo ? "Sem mensagens nesta conversa." : "Escolha uma conversa à esquerda."}
                  </p>
                ) : (
                  <ListaMensagens msgs={msgs} />
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
                  placeholder="Escreva uma mensagem"
                  aria-label="Mensagem"
                  className="flex-1 min-w-0 bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-[var(--text)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!ativo || enviando || !texto.trim()}
                  aria-label="Enviar mensagem"
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
