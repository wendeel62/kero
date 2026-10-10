import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PedidoClient from "./pedido-client";
import { getStoreBySlug } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; token: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: "Loja não encontrada — Kero" };
  return { title: `Pedido — ${store.name}`, description: "Acompanhe seu pedido em tempo real" };
}

export default async function PedidoPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const store = await getStoreBySlug(slug);
  // spec §7.1: loja inativa → 404 público
  if (!store) notFound();
  return <PedidoClient store={store} token={token} />;
}
