"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { posicaoValida, distanciaLojaCliente } from "@/lib/geocode";

type Address = {
  street?: string;
  number?: string;
  complement?: string;
  reference?: string;
  cep?: string;
  neighborhood_name?: string;
  lat?: number;
  lng?: number;
} | null;

type Stop = {
  id: string;
  seq: number;
  orderId: string;
  address: Address;
};

type Route = {
  id: string;
  status: string;
};

type Props = {
  courierId: string;
  storeId: string;
  route: Route | null;
  stops: Stop[];
  loja: { lat: number; lng: number } | null;
};

export default function MotoboyClient({ courierId, storeId, route, stops, loja }: Props) {
  const [tracking, setTracking] = useState(false);
  const [gpsBadge, setGpsBadge] = useState<"on" | "off" | "denied">("off");
  const [error, setError] = useState("");
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastSentRef = useRef(0);

  async function requestWakeLock() {
    try {
      wakeLockRef.current = await navigator.wakeLock?.request("screen");
    } catch {
      // wake lock denied — continue without it
    }
  }

  useEffect(() => {
    if (!tracking) return;

    requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const supabase = createClient();

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < 10_000) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!posicaoValida(lat, lng)) return;
        lastSentRef.current = now;
        setGpsBadge("on");
        await supabase.from("courier_positions").upsert({
          courier_id: courierId,
          store_id: storeId,
          lat,
          lng,
          precisao: pos.coords.accuracy,
          atualizado_em: new Date().toISOString(),
        });
      },
      (err) => {
        setGpsBadge("denied");
        setError(err.code === 1 ? "Permissão de GPS negada." : "Erro ao obter GPS.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [tracking, courierId, storeId]);

  function toggleTracking() {
    if (tracking) {
      setTracking(false);
      setGpsBadge("off");
    } else {
      setError("");
      setTracking(true);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1ec] p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 text-white font-display font-extrabold shadow-lg">K</span>
          <div>
            <p className="font-display font-extrabold text-lg leading-none">Kero<span className="text-red-500">.</span></p>
            <p className="text-[11px] text-stone-500 mt-0.5">motoboy</p>
          </div>
        </div>

        {route ? (
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Rota aberta</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">open</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTracking}
                className={`flex-1 font-bold text-sm rounded-xl px-4 py-3 transition-colors ${
                  tracking
                    ? "bg-stone-200 text-stone-700 hover:bg-stone-300"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {tracking ? "Parar rastreamento" : "Iniciar rastreamento"}
              </button>
              {tracking && (
                <span
                  className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    gpsBadge === "on"
                      ? "bg-green-100 text-green-700"
                      : gpsBadge === "denied"
                        ? "bg-red-100 text-red-700"
                        : "bg-stone-100 text-stone-500"
                  }`}
                >
                  GPS {gpsBadge === "on" ? "●" : gpsBadge === "denied" ? "✕" : "○"}
                </span>
              )}
            </div>

            {tracking && (
              <p className="text-[11px] text-stone-500">
                Mantenha a tela ativa para o rastreamento funcionar.
              </p>
            )}

            {error && (
              <p role="alert" className="text-[13px] font-bold text-red-600">{error}</p>
            )}

            <div className="space-y-2">
              <h3 className="font-bold text-[13px] text-stone-700">Paradas</h3>
              {stops.length === 0 && (
                <p className="text-[13px] text-stone-500">Nenhuma parada nesta rota.</p>
              )}
              {stops.map((s) => {
                const addr = s.address;
                const lat = addr?.lat;
                const lng = addr?.lng;
                const hasCoords = posicaoValida(lat ?? NaN, lng ?? NaN);
                const dist = distanciaLojaCliente(loja, addr);
                const label = [
                  addr?.street,
                  addr?.number,
                  addr?.complement,
                  addr?.neighborhood_name,
                  addr?.cep,
                ].filter(Boolean).join(", ");

                return (
                  <div key={s.id} className="flex items-center justify-between bg-stone-50 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-[13px] font-bold text-stone-700">#{s.seq} — {label}</p>
                      {addr?.reference && (
                        <p className="text-[11px] text-stone-500">Ref: {addr.reference}</p>
                      )}
                      {dist && (
                        <p className="text-[11px] text-stone-500">📍 {dist} da loja</p>
                      )}
                    </div>
                    {hasCoords && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1${loja ? `&origin=${loja.lat},${loja.lng}` : ""}&destination=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-bold text-red-600 hover:text-red-700 underline"
                      >
                        Navegar
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-[13px] text-stone-500">Nenhuma rota aberta no momento.</p>
          </div>
        )}
      </div>
    </main>
  );
}
