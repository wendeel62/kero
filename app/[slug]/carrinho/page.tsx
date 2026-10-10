import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CarrinhoClient from "./carrinho-client";
import { getAddons, getCategories, getStoreBySlug } from "@/lib/queries";
import { isStoreOpen, nextOpeningLabel } from "@/lib/store-hours";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: "Loja não encontrada — Kero" };
  return { title: `Sacola — ${store.name}`, description: "Revise seu pedido antes do checkout" };
}

export default async function CarrinhoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  // spec §7.1: loja inativa → 404 público
  if (!store) notFound();
  const isOpen = !store.force_closed && isStoreOpen(store.open_hours);
  const opensAt = nextOpeningLabel(store.open_hours);
  const [categories, addons] = await Promise.all([
    getCategories(store.id),
    getAddons(store.id),
  ]);
  return <CarrinhoClient store={store} categories={categories} addons={addons} isOpen={isOpen} opensAt={opensAt} />;
}
