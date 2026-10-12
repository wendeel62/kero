import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProdutoClient from "./produto-client";
import { getAddonGroups, getProduct, getStoreBySlug } from "@/lib/queries";
import { groupAddons } from "@/lib/addon-groups";
import { isStoreOpen, nextOpeningLabel } from "@/lib/store-hours";

type Params = { slug: string; id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, id } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: "Produto não encontrado — Kero" };
  const found = await getProduct(store.id, id);
  if (!found) return { title: "Produto não encontrado — Kero" };
  return {
    title: `${found.product.name} — ${store.name}`,
    description: found.product.description,
    openGraph: {
      title: `${found.product.name} — ${store.name}`,
      description: found.product.description,
      images: store.logo_url ?? undefined,
    },
  };
}

export default async function ProdutoPage({ params }: { params: Promise<Params> }) {
  const { slug, id } = await params;
  const store = await getStoreBySlug(slug);
  // spec §7.1: loja inativa → 404 público (não vaza existência), antes de qualquer leitura admin
  if (!store) notFound();
  const found = await getProduct(store.id, id);
  if (!found) notFound();
  // pausado NÃO dá 404 (DS §8.2): o client desabilita tudo com aviso
  const isOpen = !store.force_closed && isStoreOpen(store.open_hours);
  const opensAt = nextOpeningLabel(store.open_hours);
  const { addons: allAddons, groups } = await getAddonGroups(store.id);
  const aplicaveis = allAddons.filter((a) => a.product_id === null || a.product_id === found.product.id);
  const addonGroups = groupAddons(aplicaveis, groups);
  return (
    <ProdutoClient
      slug={slug}
      store={store}
      product={found.product}
      categoryName={found.categoryName}
      addonGroups={addonGroups}
      isOpen={isOpen}
      opensAt={opensAt}
    />
  );
}
