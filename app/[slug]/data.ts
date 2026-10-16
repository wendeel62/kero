// Leitura da vitrine pública (server-side).
// Espelha o GET /api/public/:slug/menu do original: loja + categorias ativas
// + produtos ativos + grupos/adicionais, mapeados para MenuData via mapMenu.
// Produtos e adicionais via admin (mesmo padrão do queries antigo); loja e
// categorias via anon. aberto = active && !force_closed && dentro do horário.

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isStoreOpen } from "@/lib/store-hours";
import { mapMenu, type SfMenuData } from "@/lib/storefront";

export type VitrineData = {
  menu: SfMenuData;
  storeId: string;
  isOpen: boolean;
  pixel: string | null;
  ga4: string | null;
  neighborhoods: Array<{ id: string; name: string; fee_cents: number }>;
};

export async function getVitrine(slug: string): Promise<VitrineData | null> {
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id, slug, name, logo_url, active, force_closed, open_hours")
    .eq("slug", slug)
    .eq("active", true)
    .single();
  if (!store) return null;

  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, sort_order, active")
    .eq("store_id", store.id)
    .eq("active", true)
    .order("sort_order");

  const admin = createAdminClient();
  const [{ data: prods }, { data: groups }, { data: addons }, { data: tracking }, { data: hoods }] = await Promise.all([
    admin.from("products").select("id, category_id, name, description, price_cents, image_url, active, destaque, sort_order").eq("store_id", store.id).order("sort_order"),
    admin.from("product_addon_groups").select("id, name, required, max_choices, sort_order").eq("store_id", store.id).order("sort_order"),
    admin.from("product_addons").select("id, product_id, name, price_cents, active, group_id").eq("store_id", store.id).eq("active", true),
    supabase.from("store_tracking").select("fb_pixel_id,ga4_id").eq("store_id", store.id).single(),
    supabase.from("neighborhoods").select("id, name, fee_cents").eq("store_id", store.id).eq("active", true).order("name"),
  ]);

  const aberto = store.active && !store.force_closed && isStoreOpen(store.open_hours);
  const menu = mapMenu({
    store: { id: store.id, nome: store.name, slug: store.slug, logo_url: store.logo_url },
    categories: (cats ?? []).map((c) => ({ ...c, active: true })),
    products: (prods ?? []).filter((p) => p.active).map((p) => ({ ...p, active: true, destaque: p.destaque ?? false })),
    groups: groups ?? [],
    addons: addons ?? [],
    aberto,
  });

  return {
    menu,
    storeId: store.id,
    isOpen: aberto,
    pixel: typeof tracking?.fb_pixel_id === "string" && /^[0-9]{10,20}$/.test(tracking.fb_pixel_id) ? tracking.fb_pixel_id : null,
    ga4: typeof tracking?.ga4_id === "string" && /^G-[A-Z0-9]{4,12}$/.test(tracking.ga4_id) ? tracking.ga4_id : null,
    neighborhoods: (hoods ?? []).map((n) => ({ id: n.id, name: n.name, fee_cents: n.fee_cents })),
  };
}
