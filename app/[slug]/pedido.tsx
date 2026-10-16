"use client";

import { useEffect, useRef, useState } from "react";

import { formatarMoeda } from "@/lib/storefront-cart";

// Acompanhamento do pedido — paridade com Pedido.tsx do original.
// Fonte: GET /api/orders/track/[token] (Kero). Correções sem efeito visual:
// etapa casa "out"→saiu_para_entrega; polling sem closure stale.
type Etapa = "recebido" | "preparando" | "pronto" | "saiu_entrega" | "entregue";

const ETAPAS: Array<{ id: Etapa; label: string; icon: string }> = [
  { id: "recebido", label: "Recebido", icon: "📝" },
  { id: "preparando", label: "Preparando", icon: "👨‍🍳" },
  { id: "pronto", label: "Pronto", icon: "✅" },
  { id: "saiu_entrega", label: "Saiu p/ Entrega", icon: "🚚" },
  { id: "entregue", label: "Entregue", icon: "🎉" },
];

const STATUS_ETAPA: Record<string, Etapa | "cancelado"> = {
  new: "recebido",
  confirmed: "recebido",
  preparing: "preparando",
  ready: "pronto",
  out: "saiu_entrega",
  delivered: "entregue",
  cancelled: "cancelado",
};

const STATUS_LABEL: Record<string, string> = {
  new: "recebido",
  confirmed: "confirmado",
  preparing: "preparando",
  ready: "pronto",
  out: "saiu_para_entrega",
  delivered: "entregue",
  cancelled: "cancelado",
};

type Track = {
  code: string;
  status: string;
  type: string;
  items: Array<{ name: string; qty: number; unit_price_cents: number }>;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  created_at: string;
};

export default function Pedido({ token, aoVoltar }: { token: string; aoVoltar: () => void }) {
  const [pedido, setPedido] = useState<Track | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const pedidoRef = useRef<Track | null>(null);
  pedidoRef.current = pedido;

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const res = await fetch(`/api/orders/track/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? body.code ?? "erro_interno");
        if (ativo) {
          setPedido(body as Track);
          setErro("");
        }
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "erro_interno");
      } finally {
        if (ativo) setLoading(false);
      }
    }
    carregar();
    const id = setInterval(() => {
      const atual = pedidoRef.current;
      if (!atual || !["delivered", "cancelled"].includes(atual.status)) carregar();
    }, 10000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token]);

  if (loading) return <main style={{ padding: "2rem", textAlign: "center" }}>Carregando pedido...</main>;
  if (erro || !pedido) {
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        <p>Pedido não encontrado{erro ? `: ${erro}` : ""}.</p>
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            onClick={aoVoltar}
            style={{ padding: "0.75rem 2rem", background: "#2563eb", color: "#fff", borderRadius: "0.5rem", border: "none", fontWeight: 600, cursor: "pointer" }}
          >
            Voltar ao cardápio
          </button>
        </div>
      </main>
    );
  }

  const etapa = STATUS_ETAPA[pedido.status] ?? "recebido";
  const idx = etapa === "cancelado" ? -1 : ETAPAS.findIndex((e) => e.id === etapa);
  const cancelado = etapa === "cancelado";

  return (
    <main style={{ padding: "1rem" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        {cancelado ? (
          <h1 style={{ color: "#dc2626" }}>Pedido Cancelado</h1>
        ) : (
          <>
            <h1>Pedido #{pedido.code}</h1>
            <p style={{ color: "#6b7280" }}>{new Date(pedido.created_at).toLocaleString("pt-BR")}</p>
          </>
        )}

        {!cancelado && (
          <div style={{ background: "#fef9c3", borderRadius: "0.5rem", padding: "0.5rem", textAlign: "center", marginTop: "0.5rem" }}>
            <span style={{ fontWeight: 600 }}>{STATUS_LABEL[pedido.status] ?? pedido.status}</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem", margin: "1rem 0" }}>
          {ETAPAS.map((e, i) => {
            const done = idx >= 0 && i < idx;
            const cur = i === idx;
            return (
              <div key={e.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                <div
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: done || cur ? "#fbbf24" : "#e5e7eb",
                    color: done || cur ? "#fff" : "#9ca3af",
                  }}
                >
                  {done ? "✓" : cur ? e.icon : "○"}
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: cur ? 600 : 400, color: done || cur ? "#374151" : "#9ca3af" }}>{e.label}</span>
              </div>
            );
          })}
        </div>

        {pedido.status === "out" && (
          <div data-testid="rastreio-motoboy" style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "0.75rem", padding: "1rem", marginBottom: "1rem" }}>
            <p style={{ margin: 0 }}>🛵 Seu pedido saiu para entrega!</p>
          </div>
        )}

        <h2>Resumo do pedido</h2>
        {pedido.items.map((item, i) => (
          <div key={i} style={{ background: "#ffffe6", borderRadius: "0.5rem", padding: "0.75rem", display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{item.name}</div>
            <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
              {item.qty}x • {formatarMoeda(item.unit_price_cents / 100)}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", padding: "1rem", borderRadius: "0.5rem" }}>
          <span style={{ color: "#6b7280" }}>Total</span>
          <span style={{ fontWeight: 600 }}>{formatarMoeda(pedido.total_cents / 100)}</span>
        </div>

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            onClick={aoVoltar}
            style={{ padding: "0.75rem 2rem", background: "#2563eb", color: "#fff", borderRadius: "0.5rem", border: "none", fontWeight: 600, cursor: "pointer" }}
          >
            Voltar ao cardápio
          </button>
        </div>
      </div>
    </main>
  );
}
