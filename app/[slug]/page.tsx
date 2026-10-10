import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VitrineClient from "./vitrine-client";
import { getEntry } from "./menu-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) return { title: "Loja não encontrada — Kero" };
  return {
    title: `${entry.store.name} — Kero`,
    description: entry.store.description,
    openGraph: { title: entry.store.name, description: entry.store.description },
  };
}

export default async function VitrinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getEntry(slug);
  // spec §7.1: loja inativa → 404 público (não vaza existência)
  if (!entry) notFound();
  return <VitrineClient store={entry.store} categories={entry.categories} isOpen={entry.open} opensAt={entry.opensAt} />;
}
