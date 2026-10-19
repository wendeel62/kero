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
  const results = await Promise.all([
    admin.from("products").select("id, category_id, name, description, price_cents, image_url, active, destaque, sort_order").eq("store_id", store.id).order("sort_order"),
    admin.from("product_addon_groups").select("id, name, required, max_choices, sort_order, price_rule, free_addons, min_choices, is_preparation").eq("store_id", store.id).order("sort_order"),
    admin.from("product_addons").select("id, product_id, name, price_cents, active, group_id, is_removal, is_separate").eq("store_id", store.id).eq("active", true),
    admin.from("product_variations").select("id, product_id, name, price_cents, sort_order, active").eq("store_id", store.id).eq("active", true).order("sort_order"),
    admin.from("product_custom_fields").select("id, product_id, label, required, max_length, sort_order").eq("store_id", store.id).order("sort_order"),
    admin.from("combos").select("id, name, description, price_cents, image_url, active, sort_order").eq("store_id", store.id).order("sort_order"),
    admin.from("combo_items").select("id, combo_id, product_id, qty, optional, sort_order").eq("store_id", store.id).order("sort_order"),
    supabase.from("store_tracking").select("fb_pixel_id,ga4_id").eq("store_id", store.id).single(),
    supabase.from("neighborhoods").select("id, name, fee_cents").eq("store_id", store.id).eq("active", true).order("name"),
  ]);
  const [rProds, rGroups, rAddons, rVariations, rCustomFields, rCombos, rComboItems, rTracking, rHoods] = results;
  // store_tracking e' opcional (usa .single()): nao ha registro => sem pixel/GA4, nao derruba a pagina.
  const fetchErrors = results.filter((r, i) => r.error && !(i === 7 && r.data === null)).map((r) => r.error?.message);
  if (fetchErrors.length) throw new Error("Falha ao carregar cardápio: " + fetchErrors.join("; "));
  const { data: prods } = rProds;
  const { data: groups } = rGroups;
  const { data: addons } = rAddons;
  const { data: variations } = rVariations;
  const { data: customFields } = rCustomFields;
  const { data: combos } = rCombos;
  const { data: comboItems } = rComboItems;
  const { data: tracking } = rTracking;
  const { data: hoods } = rHoods;

  const aberto = store.active && !store.force_closed && isStoreOpen(store.open_hours);
  const menu = mapMenu({
    store: { id: store.id, nome: store.name, slug: store.slug, logo_url: store.logo_url },
    categories: (cats ?? []).map((c) => ({ ...c, active: true })),
    products: (prods ?? []).filter((p) => p.active).map((p) => ({ ...p, active: true, destaque: p.destaque ?? false })),
    groups: groups ?? [],
    addons: addons ?? [],
    variations: variations ?? [],
    customFields: customFields ?? [],
    combos: combos ?? [],
    comboItems: comboItems ?? [],
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
