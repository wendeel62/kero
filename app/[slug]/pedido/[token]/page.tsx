import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PedidoClient from "./pedido-client";
import { demoOrder, getEntry } from "../../menu-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; token: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) return { title: "Loja não encontrada — Kero" };
  return { title: `Pedido — ${entry.store.name}`, description: "Acompanhe seu pedido em tempo real" };
}

export default async function PedidoPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const entry = getEntry(slug);
  // spec §7.1: loja inativa → 404 público
  if (!entry) notFound();
  // fase backend: GET /api/orders/track/[token] valida o token; preview usa pedido demo
  return <PedidoClient store={entry.store} token={token} order={demoOrder()} />;
}
