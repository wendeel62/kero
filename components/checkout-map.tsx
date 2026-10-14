"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 48px de área de toque (o emoji sozinho é pequeno demais p/ arrastar)
const pinIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;' +
    'font-size:36px;line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.45));cursor:grab">📍</div>',
  iconSize: [48, 48],
  iconAnchor: [24, 44],
});

export default function CheckoutMap({
  lat,
  lng,
  onChange,
  onInteract,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  /** o cliente assumiu o controle (começou a arrastar) — o consumidor para de
   *  sobrescrever a posição (ex.: o checkout cancela a geocodificação). */
  onInteract?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: [lat, lng], zoom: 16 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    // clicar no mapa coloca o pino: arrastar um alvo de 48px é ruim no celular
    map.on("click", (e: L.LeafletMouseEvent) => onChange(e.latlng.lat, e.latlng.lng));
    const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
    // o Marker emite 'drag' durante o gesto (é o que registra a posição);
    // 'dragend' não chega ao handler — mantido só p/ encerrar o estado de arrasto
    const sync = () => {
      const ll = marker.getLatLng();
      onChange(ll.lat, ll.lng);
    };
    marker.on("dragstart", () => {
      draggingRef.current = true;
      onInteract?.();
    });
    marker.on("drag", sync);
    marker.on("dragend", () => {
      draggingRef.current = false;
      sync();
    });
    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    // durante o arrasto quem manda na posição é o gesto — setLatLng/panTo brigariam com ele
    if (draggingRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.panTo([lat, lng]);
  }, [lat, lng]);

  return <div ref={ref} style={{ height: 260, borderRadius: 12 }} />;
}
