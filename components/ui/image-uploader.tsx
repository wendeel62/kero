"use client";

// Tile clicável com prévia (DS §4 item 12): valida tipo, redimensiona p/ 1200px
// e comprime canvas→WebP até caber em 1MB; erros PT-BR exatos.
// ponytail: sem lib de upload — canvas nativo + storage direto do browser.
import { useRef, useState } from "react";

import { MAX_IMAGE_BYTES, MAX_IMAGE_WIDTH, pickQuality, shouldRejectType } from "@/lib/image";

const toBlob = (img: HTMLImageElement, q: number) =>
  new Promise<Blob | null>((resolve) => {
    const scale = Math.min(1, MAX_IMAGE_WIDTH / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(resolve, "image/webp", q);
  });

async function compress(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    // tenta a qualidade do tamanho de entrada, depois desce até 0.8
    for (const q of [pickQuality(file.size), 0.9, 0.8]) {
      const blob = await toBlob(img, q);
      if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
    }
    throw new Error("TOO_BIG");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ImageUploader({
  currentUrl, fallbackEmoji = "📷", onBlob, onError,
}: {
  currentUrl: string | null; fallbackEmoji?: string;
  onBlob: (blob: Blob, previewUrl: string, name: string) => void;
  onError: (msg: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (shouldRejectType(f.type)) {
      onError("Formato inválido");
      return;
    }
    setBusy(true);
    try {
      const blob = await compress(f);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      onBlob(blob, url, f.name.replace(/\.[^.]+$/, "") + ".webp");
    } catch {
      onError("Arquivo muito grande (máx 1MB após compressão)");
    } finally {
      setBusy(false);
    }
  };

  const shown = preview ?? currentUrl;

  return (
    <label className="shrink-0 w-28 h-24 rounded-2xl bg-gradient-to-br from-[var(--amber-soft)] to-[var(--red-soft)] border-2 border-dashed border-[var(--border)] hover:border-[var(--red)] flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="Prévia da foto" className="w-full h-full object-cover" />
      ) : (
        <span className="text-center px-2">
          <span className="block text-2xl">{busy ? "⏳" : fallbackEmoji}</span>
          <span className="block text-[11px] font-bold text-[var(--muted)] mt-1">{busy ? "comprimindo…" : "enviar foto"}</span>
        </span>
      )}
      <input ref={input} type="file" accept="image/*" className="sr-only"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}
