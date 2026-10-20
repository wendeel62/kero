"use client";

import { useCallback, useEffect, useState } from "react";
import WhatsAppInbox from "@/components/whatsapp/whatsapp-inbox";

type Estado = "carregando" | "desconectado" | "conectando" | "conectado";

const LABEL: Record<string, string> = {
  WORKING: "Conectado",
  SCAN_QR_CODE: "Aguardando leitura do QR",
  STARTING: "Iniciando sessão…",
  FAILED: "A conexão falhou",
  STOPPED: "Sessão parada",
  PASSKEY_REQUIRED: "Verificação necessária no celular",
};

export default function WhatsAppPage() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [wahaStatus, setWahaStatus] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const r = await fetch("/api/whatsapp/status");
      if (!r.ok) { setEstado("desconectado"); return; }
      const d = await r.json();
      setWahaStatus(d.status);
      setPhone(d.phone);
      setEstado(d.status === "WORKING" ? "conectado" : "desconectado");
    } catch {
      setEstado("desconectado");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Poll enquanto conecta: status a cada 2s e, se ainda não conectou, o QR.
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
      setEstado("desconectado");
    } catch {
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
        <section className="mt-3 bg-[var(--surface)] border rounded-3xl shadow-sm anim-rise overflow-hidden h-[70vh]">
          <WhatsAppInbox />
        </section>
      )}
    </main>
  );
}
