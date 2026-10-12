"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/deliveries";

type CourierPin = { courierId: string; nome: string; lat: number; lng: number; atualizadoEm: string };

const pinIcon = (label: string, color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const scooterIcon = (nome: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:#1d4ed8;color:#fff;border-radius:9999px;padding:2px 8px;font-size:18px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)" title="${nome}">&#x1F6F5;</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

export default function DeliveryMap({
  points,
  couriers,
}: {
  points: MapPoint[];
  couriers?: CourierPin[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: [-3.10, -60.00], zoom: 13 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const latlngs: L.LatLngExpression[] = [];
    for (const p of points) {
      L.marker([p.lat, p.lng], { icon: pinIcon(p.code, "#d97706") })
        .addTo(layer)
        .bindPopup(`#${p.code} — ${p.status}`);
      latlngs.push([p.lat, p.lng]);
    }
    if (couriers) {
      for (const c of couriers) {
        L.marker([c.lat, c.lng], { icon: scooterIcon(c.nome) })
          .addTo(layer)
          .bindPopup(`&#x1F6F5; ${c.nome}`);
        latlngs.push([c.lat, c.lng]);
      }
    }
    if (latlngs.length > 0) {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.15));
    }
  }, [points, couriers]);

  return <div ref={ref} style={{ height: 320, borderRadius: 12 }} />;
}
