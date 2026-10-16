"use client";

import { useEffect, useState } from "react";
import { lerConsentimento, salvarConsentimento, type Consentimento } from "@/lib/consent";

// Banner LGPD — paridade com cardapio-digital CookieBanner.tsx.
// Recusa não bloqueia o cardápio; aceite dispara "kero:consent-aceito"
// para o TrackingGate injetar pixel/GA4 sem reload.
export default function CookieBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lerConsentimento(window.localStorage) === null) setVisivel(true);
  }, []);

  function decidir(v: Consentimento) {
    salvarConsentimento(window.localStorage, v);
    setVisivel(false);
    if (v === "aceito") window.dispatchEvent(new Event("kero:consent-aceito"));
  }

  if (!visivel) return null;

  return (
    <div
      data-testid="cookie-banner"
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-0 inset-x-0 z-[100] bg-white border-t border-stone-200 px-4 py-3 flex flex-wrap items-center gap-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
    >
      <p className="flex-1 min-w-[220px] m-0 text-[13px] text-stone-600">
        🍪 Usamos cookies para melhorar sua experiência e medir visitas. Você pode aceitar ou recusar — a recusa não bloqueia o cardápio.
      </p>
      <button
        onClick={() => decidir("recusado")}
        className="min-h-[44px] px-4 rounded-lg border border-stone-300 bg-white text-sm font-bold text-stone-700"
      >
        Recusar
      </button>
      <button
        onClick={() => decidir("aceito")}
        className="min-h-[44px] px-4 rounded-lg bg-[#FFCE12] text-sm font-bold text-stone-900"
      >
        Aceitar
      </button>
    </div>
  );
}
