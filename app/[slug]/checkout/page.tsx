import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CheckoutClient from "./checkout-client";
import { NEIGHBORHOODS, getEntry } from "../menu-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) return { title: "Loja não encontrada — Kero" };
  return { title: `Checkout — ${entry.store.name}`, description: "Finalize seu pedido: entrega ou retirada, pagamento na hora" };
}

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getEntry(slug);
  // spec §7.1: loja inativa → 404 público
  if (!entry) notFound();
  return (
    <CheckoutClient
      store={entry.store}
      categories={entry.categories}
      neighborhoods={NEIGHBORHOODS}
      isOpen={entry.open}
      opensAt={entry.opensAt}
    />
  );
}
