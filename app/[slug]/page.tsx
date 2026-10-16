import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VitrineClient from "./vitrine-client";
import { getAddons, getCategories, getNeighborhoods, getStoreBySlug } from "@/lib/queries";
import { isStoreOpen, nextOpeningLabel } from "@/lib/store-hours";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: "Loja não encontrada — Kero" };
  return {
    title: `${store.name} — Kero`,
    description: store.description,
    openGraph: { title: store.name, description: store.description, images: store.logo_url ?? undefined },
  };
}

export default async function VitrinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  // spec §7.1: loja inativa → 404 público (não vaza existência), antes de qualquer leitura admin
  if (!store) notFound();
  const isOpen = !store.force_closed && isStoreOpen(store.open_hours);
  const opensAt = nextOpeningLabel(store.open_hours);
  const [neighborhoods, categories, addons] = await Promise.all([
    getNeighborhoods(store.id),
    getCategories(store.id),
    getAddons(store.id),
  ]);
  const minFee = neighborhoods.length ? Math.min(...neighborhoods.map((n) => n.fee_cents)) : null;
  return <VitrineClient store={store} categories={categories} addons={addons} isOpen={isOpen} opensAt={opensAt} minFee={minFee} />;
}
