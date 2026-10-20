"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { getPedido } from "@/lib/painel";
import type { PanelDetail } from "@/lib/painel-utils";
import { StatusBadge } from "@/components/ui/status-badge";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Gera QR code simples via Google Charts API (sem dependência extra)
function QrCode({ data, size = 80 }: { data: string; size?: number }) {
  const url = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(data)}&chs=${size}x${size}&choe=UTF-8`;
  return <img src={url} alt="QR code do pedido" width={size} height={size} style={{ display: "block", margin: "0 auto" }} />;
}

export default function CupomPrint() {
  const id = useParams().id as string;
  const [order, setOrder] = useState<PanelDetail | null | undefined>(undefined);
  useEffect(() => {
    getPedido(id).then(({ order: o }) => setOrder(o)).catch(() => setOrder(null));
  }, [id]);

  if (order === undefined) {
    return (
      <div className="min-h-screen bg-stone-200 py-8 flex flex-col items-center">
        <p className="text-sm text-stone-500 animate-pulse">Carregando cupom…</p>
      </div>
    );
  }
  if (order === null) notFound();

  const items = order.items;
  const subtotal = order.subtotal;
  const fee = order.type === "delivery" ? order.fee : 0;
  // acompanhamento e' por query param (deep-link da vitrine), nao sub-rota
  const trackPath = `${order.store.slug}?pedido=${order.trackingToken}`;
  // endereco: checkout salva `endereco` (string completa); pedidos antigos
  // podem ter `street`/`number`. Trata os dois formatos.
  const addr = order.address as { endereco?: string; street?: string; number?: string; complement?: string | null; cep?: string; neighborhood_name?: string } | null;
  const enderecoLinha = addr?.endereco?.trim()
    ? addr.endereco.trim()
    : [addr?.street?.trim(), addr?.number?.trim()].filter(Boolean).join(", ");
  const bairroLinha = [addr?.neighborhood_name?.trim(), addr?.cep ? `CEP ${addr.cep}` : ""].filter(Boolean).join(" · ");

  return (
    <>
      <style>{`@page { size: 80mm auto; margin: 0; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          .cupom { width: 80mm !important; box-shadow: none !important; border: none !important; margin: 0 !important; }
        }`}</style>
      <div className="min-h-screen bg-stone-200 py-8 flex flex-col items-center gap-4">
        <div className="no-print flex gap-2">
          <Link href={`/painel/pedidos/${order.id}`}
            className="bg-white border font-bold rounded-xl px-5 py-2.5 text-sm hover:border-stone-400 transition-colors">
            ← Voltar
          </Link>
          <button onClick={() => window.print()}
            className="bg-stone-900 text-white font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-stone-700 transition-colors">
            🖨 Imprimir
          </button>
          <button onClick={() => window.open(`${window.location.href}?via=2`, "_blank")}
            className="bg-stone-600 text-white font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-stone-700 transition-colors">
            📄 2ª Via
          </button>
        </div>
        {/* cupom 80mm — spec: bobina, A4 só relatório */}
        <article className="cupom w-[80mm] bg-white shadow-xl font-mono text-[12px] leading-snug p-3">
          <div className="text-center">
            <p className="font-bold text-base tracking-wide">{order.store.name.toUpperCase()}</p>
            <p className="font-bold">{order.store.whatsapp}</p>
          </div>
          <p className="font-bold my-1">================================</p>
          <p className="text-center font-bold text-[28px] tracking-[0.2em]">#{order.code}</p>
          <p className="text-center font-bold text-sm">
            *** {order.type === "delivery" ? "ENTREGA" : "RETIRADA"} ***
          </p>
          <p className="text-center mt-1 font-sans"><StatusBadge status={order.status} size="sm" /></p>
          <p className="text-center">recebido há {order.minutesAgo} min · {order.payment}</p>
          <p className="font-bold my-1">================================</p>
          <p className="font-bold text-sm">{order.customer.toUpperCase()}</p>
          <p>{order.phone}</p>
          {order.type === "delivery" && order.address && (
            <p className="font-bold">→ {enderecoLinha}{addr?.complement?.trim() ? ` · ${addr.complement.trim()}` : ""}<br />→ {bairroLinha}</p>
          )}
          {order.notes && <p>obs: {order.notes}</p>}
          <p className="font-bold my-1">--------------------------------</p>
          <ul>
            {items.map((it) => (
              <li key={it.name} className="mb-1.5">
                <p className="flex justify-between gap-1 font-bold text-[13px]">
                  <span>{it.qty}× {it.name.toUpperCase()}</span>
                  <span>{brl(it.unit * it.qty).replace("R$", "")}</span>
                </p>
                {it.addons.map((a) => (
                  <p key={a} className="pl-3">+ {a}</p>
                ))}
                {it.notes && <p className="pl-3 font-bold">*** OBS: {it.notes} ***</p>}
              </li>
            ))}
          </ul>
          <p className="font-bold my-1">--------------------------------</p>
          <p className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal).replace("R$", "")}</span></p>
          <p className="flex justify-between"><span>Entrega</span><span>{order.type === "delivery" ? brl(fee).replace("R$", "") : "0,00"}</span></p>
          <p className="font-bold my-1">================================</p>
          <p className="flex justify-between font-bold text-lg"><span>TOTAL R$</span><span>{brl(subtotal + fee).replace("R$", "")}</span></p>
          <p className="font-bold my-1">================================</p>
          <p className="text-center font-bold text-sm">
            {order.paymentMethod === "cash" && order.changeFor != null ? `*** TROCO P/ ${brl(order.changeFor).toUpperCase()} ***` : order.payment.toUpperCase()}
          </p>
          <p className="font-bold my-1">--------------------------------</p>
          <p className="text-center">Acompanhe: {typeof window !== "undefined" ? `${window.location.origin}/${trackPath}` : trackPath}</p>
          <QrCode data={`${typeof window !== "undefined" ? window.location.origin : ""}/${trackPath}`} size={64} />
          <p className="text-center font-bold text-[10px] mt-1">Escaneie para acompanhar</p>
          <p className="font-bold my-1">--------------------------------</p>
          <p className="text-center">Acompanhe: {typeof window !== "undefined" ? `${window.location.origin}/${trackPath}` : trackPath}</p>
          <p className="text-center font-bold">Obrigado! Até a próxima 🙏</p>
          <p className="no-print text-center text-stone-400 font-sans text-[11px] mt-1">pré-visualização em tela — na bobina sai sem sombras</p>
        </article>
      </div>
    </>
  );
}
