"use client";

// Live do painel (SPEC §9/§11, risco nº 1): Realtime de orders + som ≤150ms +
// badge no favicon. Nativo (WebAudio/canvas) + supabase-js já instalado; sem
// assets, sem libs. Tudo aqui é no-op fora do browser.
import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

import { toPanelOrder, type PanelOrder, type PanelRow } from "./painel-utils";

// — som: bipe duplo WebAudio totalizando ~140ms; contexto criado só após gesto —
let ctx: AudioContext | null = null;

export function unlockPanelAudio() {
  const arm = () => {
    try {
      ctx ??= new AudioContext();
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      /* sem áudio neste browser */
    }
  };
  window.addEventListener("pointerdown", arm, { once: true });
  window.addEventListener("keydown", arm, { once: true });
}

export function playNewOrderSound() {
  try {
    if (!ctx || ctx.state !== "running") return; // sem gesto ainda: silêncio
    const t = ctx.currentTime;
    for (const [freq, dt] of [[880, 0], [660, 0.07]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.5, t + dt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.07);
      o.connect(g).connect(ctx.destination);
      o.start(t + dt);
      o.stop(t + dt + 0.075);
    }
  } catch {
    /* som é ornamento */
  }
}

// — badge: contador sobre o favicon + document.title —
let originalIcon: string | null | undefined;

export function updateFaviconBadge(count: number) {
  if (typeof document === "undefined") return;
  document.title = count > 0 ? `(${count}) Kero — Delivery` : "Kero — Delivery";
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (originalIcon === undefined) originalIcon = link?.href ?? null;
  if (count <= 0) {
    if (link && originalIcon) link.href = originalIcon;
    return;
  }
  const s = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#dc2626";
  c.beginPath();
  c.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#fff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `bold ${count > 9 ? 15 : 19}px system-ui, sans-serif`;
  c.fillText(count > 99 ? "99+" : String(count), s / 2, s / 2 + 1);
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL();
}

type LiveCbs = {
  onInsert: (o: PanelOrder) => void;
  onUpdate: (o: PanelOrder) => void;
  onLive: (live: boolean) => void;
};

// Assina orders da loja; onLive(false) = caiu (o caller liga polling 30s).
export function usePanelLive(storeId: string | null, cbs: LiveCbs) {
  const ref = useRef(cbs);
  ref.current = cbs;
  useEffect(() => {
    if (!storeId) return;
    unlockPanelAudio();
    const sb = createClient();
    const ch = sb
      .channel(`orders:${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (p) => {
          const row = (p.eventType === "DELETE" ? p.old : p.new) as unknown as PanelRow;
          if (!row?.id) return;
          if (p.eventType === "INSERT") ref.current.onInsert(toPanelOrder(row));
          else ref.current.onUpdate(toPanelOrder(row));
        },
      )
      .subscribe((status) => ref.current.onLive(status === "SUBSCRIBED"));
    return () => {
      void sb.removeChannel(ch);
    };
  }, [storeId]);
}

// Assina courier_positions da loja para o mapa ao vivo.
export function useCouriersLive(
  storeId: string | null,
  onPosicao: (p: { courierId: string; lat: number; lng: number; atualizadoEm: string }) => void,
) {
  const ref = useRef(onPosicao);
  ref.current = onPosicao;
  useEffect(() => {
    if (!storeId) return;
    const sb = createClient();
    const ch = sb
      .channel(`couriers:${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courier_positions", filter: `store_id=eq.${storeId}` },
        (p) => {
          const row = p.new as { courier_id: string; lat: number; lng: number; atualizado_em: string };
          if (!row?.courier_id) return;
          ref.current({ courierId: row.courier_id, lat: row.lat, lng: row.lng, atualizadoEm: row.atualizado_em });
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [storeId]);
}
