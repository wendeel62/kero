import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreBySlug } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { sanitizeTrackingId } from "@/lib/tracking";
import TrackingGate from "@/components/tracking-gate";
import CookieBanner from "@/components/cookie-banner";

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
  // IDs de rastreio sanitizados no servidor; injeção só com consentimento (LGPD).
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_tracking")
    .select("fb_pixel_id,ga4_id")
    .eq("store_id", store.id)
    .single();
  const pixel = sanitizeTrackingId("pixel", data?.fb_pixel_id);
  const ga4 = sanitizeTrackingId("ga4", data?.ga4_id);
  return (
    <>
      <TrackingGate pixel={pixel} ga4={ga4} />
      {children}
      <CookieBanner />
    </>
  );
}
