import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreBySlug } from "@/lib/queries";
import TrackingScripts from "@/components/tracking-scripts";

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

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  return (
    <>
      <TrackingScripts storeId={store.id} />
      {children}
    </>
  );
}
