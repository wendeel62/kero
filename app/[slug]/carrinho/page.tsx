import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CarrinhoClient from "./carrinho-client";
import { getEntry } from "../menu-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) return { title: "Loja não encontrada — Kero" };
  return { title: `Sacola — ${entry.store.name}`, description: "Revise seu pedido antes do checkout" };
}

export default async function CarrinhoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getEntry(slug);
  // spec §7.1: loja inativa → 404 público
  if (!entry) notFound();
  return <CarrinhoClient store={entry.store} categories={entry.categories} isOpen={entry.open} opensAt={entry.opensAt} />;
}
