import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CookieBanner from "./cookie-banner";
import { getVitrine } from "./data";
import StorefrontClient from "./storefront-client";
import TrackingGate from "./tracking-gate";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getVitrine(slug);
  if (!data) return { title: "Loja não encontrada — Kero" };
  return { title: `${data.menu.business.nome} — Cardápio`, description: `Cardápio de ${data.menu.business.nome}` };
}

export default async function StoreLayout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getVitrine(slug);
  if (!data) notFound();
  return (
    <>
      <TrackingGate pixel={data.pixel} ga4={data.ga4} />
      <StorefrontClient menu={data.menu} isOpen={data.isOpen} neighborhoods={data.neighborhoods} storeId={data.storeId} />
      <CookieBanner />
    </>
  );
}
