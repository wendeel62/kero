"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/deliveries";
import { posicaoRecente } from "@/lib/couriers";

type CourierPin = { courierId: string; nome: string; lat: number; lng: number; atualizadoEm: string };

const pinIcon = (label: string, color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const scooterIcon = (nome: string, opaco = false) =>
  L.divIcon({
    className: "",
    html: `<div style="background:#1d4ed8;color:#fff;border-radius:9999px;padding:2px 8px;font-size:18px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);${opaco ? "opacity:0.3;" : ""}" title="${nome}">&#x1F6F5;</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

// ponto fixo da loja — a origem das entregas no mapa
const lojaIcon = L.divIcon({
  className: "",
  html: '<div style="background:#111827;color:#fff;border-radius:9999px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)" title="Loja">&#x1F3EA;</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function DeliveryMap({
  points,
  couriers,
  loja,
}: {
  points: MapPoint[];
  couriers?: CourierPin[];
  loja?: { lat: number; lng: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: loja ? [loja.lat, loja.lng] : [-3.1, -60.0], zoom: loja ? 15 : 13 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const latlngs: L.LatLngExpression[] = [];
    if (loja) {
      L.marker([loja.lat, loja.lng], { icon: lojaIcon }).addTo(layer).bindPopup("&#x1F3EA; Loja (origem)");
      latlngs.push([loja.lat, loja.lng]);
    }
    for (const p of points) {
      L.marker([p.lat, p.lng], { icon: pinIcon(p.code, "#d97706") })
        .addTo(layer)
        .bindPopup(`#${p.code} — ${p.status}${p.distKm ? ` · ${p.distKm} da loja` : ""}`);
      latlngs.push([p.lat, p.lng]);
    }
    if (couriers) {
      const agora = Date.now();
      for (const c of couriers) {
        L.marker([c.lat, c.lng], { icon: scooterIcon(c.nome, !posicaoRecente(c.atualizadoEm, agora)) })
          .addTo(layer)
          .bindPopup(`&#x1F6F5; ${c.nome}`);
        latlngs.push([c.lat, c.lng]);
      }
    }
    if (latlngs.length > 0) {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.15));
    }
  }, [points, couriers, loja]);

  return <div ref={ref} style={{ height: 320, borderRadius: 12 }} />;
}
