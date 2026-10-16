"use client";

import { useEffect } from "react";

// Injeta Meta Pixel + GA4 SOMENTE com consentimento aceito (paridade com
// injetarRastreamentoSeConsentido do original). IDs sanitizados no servidor.
// Ouve "kero:consent-aceito" para injetar logo após o aceite sem reload.
export default function TrackingGate({ pixel, ga4 }: { pixel: string | null; ga4: string | null }) {
  useEffect(() => {
    if (!pixel && !ga4) return;
    function consentido(): boolean {
      try {
        return window.localStorage.getItem("lgpd-consentimento") === "aceito";
      } catch {
        return false;
      }
    }
    function injetar() {
      if (!consentido()) return;
      if (pixel && !document.getElementById("fb-pixel")) {
        const w = window as unknown as {
          fbq?: ((...a: unknown[]) => void) & { queue: unknown[]; push: unknown; loaded: boolean; version: string };
          _fbq?: unknown;
        };
        if (!w.fbq) {
          const n = function fbq(...args: unknown[]) {
            n.queue.push(args);
          } as ((...a: unknown[]) => void) & { queue: unknown[]; push: unknown; loaded: boolean; version: string };
          n.push = n;
          n.loaded = true;
          n.version = "2.0";
          n.queue = [];
          w.fbq = n;
          w._fbq = n;
          const s = document.createElement("script");
          s.id = "fb-pixel";
          s.async = true;
          s.src = "https://connect.facebook.net/en_US/fbevents.js";
          document.head.appendChild(s);
        }
        w.fbq?.("init", pixel);
        w.fbq?.("track", "PageView");
      }
      if (ga4 && !document.getElementById("ga4-script")) {
        const s = document.createElement("script");
        s.id = "ga4-script";
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${ga4}`;
        document.head.appendChild(s);
        const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
        w.dataLayer = w.dataLayer ?? [];
        w.gtag = function gtag(...args: unknown[]) {
          w.dataLayer!.push(args);
        };
        w.gtag("js", new Date());
        w.gtag("config", ga4);
      }
    }
    injetar();
    window.addEventListener("kero:consent-aceito", injetar);
    return () => window.removeEventListener("kero:consent-aceito", injetar);
  }, [pixel, ga4]);

  return null;
}
