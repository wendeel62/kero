import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CheckoutClient from "./checkout-client";
import { getAddons, getCategories, getNeighborhoods, getStoreBySlug } from "@/lib/queries";
import { isStoreOpen, nextOpeningLabel } from "@/lib/store-hours";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: "Loja não encontrada — Kero" };
  return { title: `Checkout — ${store.name}`, description: "Finalize seu pedido: entrega ou retirada, pagamento na hora" };
}

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  // spec §7.1: loja inativa → 404 público
  if (!store) notFound();
  const isOpen = !store.force_closed && isStoreOpen(store.open_hours);
  const opensAt = nextOpeningLabel(store.open_hours);
  const [categories, neighborhoods, addons] = await Promise.all([
    getCategories(store.id),
    getNeighborhoods(store.id),
    getAddons(store.id),
  ]);
  return (
    <CheckoutClient
      store={store}
      storeId={store.id}
      categories={categories}
      neighborhoods={neighborhoods}
      addons={addons}
      isOpen={isOpen}
      opensAt={opensAt}
    />
  );
}
