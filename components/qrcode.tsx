"use client";

import { useState, useEffect } from "react";
import { toDataURL } from "qrcode";

// Gera um QR code em SVG (data URL) localmente, sem depender de API externa.
// Útil para impressão térmica 80mm (cupons), onde o Google Charts API não está mais disponível.
export function QrCode({ data, size = 80 }: { data: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    toDataURL(data, { type: "svg", width: size, margin: 2, color: { dark: "#000", light: "#fff" } })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [data, size]);

  if (!svg) return null;
  return (
    <img
      src={svg}
      alt="QR code do pedido"
      width={size}
      height={size}
      style={{ display: "block", margin: "0 auto" }}
    />
  );
}
