import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProdutoClient from "./produto-client";
import { GLOBAL_ADDONS, findProduct } from "../../menu-data";

type Params = { slug: string; id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, id } = await params;
  const found = findProduct(slug, id);
  if (!found) return { title: "Produto não encontrado — Kero" };
  return {
    title: `${found.product.name} — ${found.store.name}`,
    description: found.product.description,
    openGraph: { title: `${found.product.name} — ${found.store.name}`, description: found.product.description },
  };
}

export default async function ProdutoPage({ params }: { params: Promise<Params> }) {
  const { slug, id } = await params;
  const found = findProduct(slug, id);
  if (!found) notFound();
  return (
    <ProdutoClient
      slug={slug}
      store={found.store}
      product={found.product}
      categoryName={found.categoryName}
      addons={GLOBAL_ADDONS}
      isOpen={found.open}
      opensAt={found.opensAt}
    />
  );
}
