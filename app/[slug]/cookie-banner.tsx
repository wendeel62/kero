"use client";

import { useEffect, useState } from "react";

// Banner LGPD — paridade com CookieBanner.tsx do original.
// Mesma chave (lgpd-consentimento), mesma copy, recusa não bloqueia.
// Aceite dispara "kero:consent-aceito" para o TrackingGate injetar sem reload.
export default function CookieBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("lgpd-consentimento") === null) setVisivel(true);
    } catch {
      setVisivel(false);
    }
  }, []);

  function decidir(valor: "aceito" | "recusado") {
    try {
      window.localStorage.setItem("lgpd-consentimento", valor);
    } catch {
      // storage indisponível: só esconde
    }
    setVisivel(false);
    if (valor === "aceito") window.dispatchEvent(new Event("kero:consent-aceito"));
  }

  if (!visivel) return null;

  return (
    <div
      data-testid="cookie-banner"
      role="dialog"
      aria-label="Consentimento de cookies"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--color-surface, #fff)",
        borderTop: "1px solid var(--color-border, #e5e7eb)",
        padding: "1rem",
        display: "flex",
        gap: "0.75rem",
        alignItems: "center",
        flexWrap: "wrap",
        boxShadow: "0 -2px 8px rgba(0,0,0,.08)",
      }}
    >
      <p style={{ flex: 1, minWidth: 220, margin: 0, fontSize: "0.85rem" }}>
        🍪 Usamos cookies para melhorar sua experiência e medir visitas. Você pode aceitar ou recusar — a recusa não bloqueia o cardápio.
      </p>
      <button onClick={() => decidir("recusado")} style={{ background: "var(--color-surface, #fff)", color: "var(--color-text, #333)", border: "1px solid var(--color-border)" }}>
        Recusar
      </button>
      <button onClick={() => decidir("aceito")} style={{ background: "var(--color-primary)", minHeight: 44 }}>
        Aceitar
      </button>
    </div>
  );
}
