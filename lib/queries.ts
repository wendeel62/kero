import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category, Neighborhood, Product, Store } from "@/app/[slug]/menu-data";
import type { AddonGroupRow } from "@/lib/addon-groups";

// Leituras públicas da vitrine via RLS (anon, sem sessão). Erros → null/[]; a página decide notFound().
export async function getStoreBySlug(slug: string): Promise<(Store & { id: string; open_hours: unknown }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stores").select("*").eq("slug", slug).eq("active", true).single();
  if (error || !data) return null;
  return {
    id: data.id, open_hours: data.open_hours,
    slug: data.slug, name: data.name, description: data.description ?? "",
    logo_url: data.logo_url ?? null, marquee_text: data.marquee_text ?? null,
    cover_url: data.cover_url ?? null, whatsapp: data.whatsapp,
    min_order_cents: data.min_order_cents ?? 0,
    prep_time_min: data.prep_time_min ?? 0, prep_time_max: data.prep_time_max ?? 0,
    active: data.active, force_closed: data.force_closed ?? false,
  };
}

export async function getCategories(store_id: string): Promise<Category[]> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from("categories").select("id,name").eq("store_id", store_id).eq("active", true).order("sort_order"),
    admin.from("products").select("id,category_id,name,description,price_cents,image_url,active").eq("store_id", store_id).order("sort_order"),
  ]);
  const byCat = new Map<string, Product[]>();
  for (const p of prods ?? []) {
    const list = byCat.get(p.category_id) ?? [];
    list.push({ id: p.id, name: p.name, description: p.description ?? "", price_cents: p.price_cents, image_url: p.image_url ?? null, active: p.active });
    byCat.set(p.category_id, list);
  }
  return (cats ?? []).map((c) => ({ id: c.id, name: c.name, products: byCat.get(c.id) ?? [] }));
}

export async function getProduct(store_id: string, id: string): Promise<{ product: Product; categoryName: string } | null> {
  const supabase = await createClient();
  const { data: p, error } = await createAdminClient().from("products").select("id,category_id,name,description,price_cents,image_url,active").eq("store_id", store_id).eq("id", id).single();
  if (error || !p) return null;
  const { data: c } = await supabase.from("categories").select("name").eq("id", p.category_id).single();
  return {
    product: { id: p.id, name: p.name, description: p.description ?? "", price_cents: p.price_cents, image_url: p.image_url ?? null, active: p.active },
    categoryName: c?.name ?? "",
  };
}

export async function getNeighborhoods(store_id: string): Promise<Neighborhood[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("neighborhoods").select("id,name,fee_cents,active").eq("store_id", store_id).eq("active", true).order("fee_cents");
  if (error || !data) return [];
  return data.map((n) => ({ id: n.id, name: n.name, fee_cents: n.fee_cents, active: n.active }));
}

// Lista plana de adicionais ativos — carrinho e checkout só precisam do lookup
// de preço/nome por id; não usam grupos. Wrapper fino sobre getAddonGroups.
export async function getAddons(store_id: string) {
  const { addons } = await getAddonGroups(store_id);
  return addons;
}

// Grupos de opção da vitrine (migration 012): devolve os adicionais ativos e os
// grupos, para o cliente agrupar com groupAddons (lib/addon-groups.ts).
export async function getAddonGroups(store_id: string) {
  const supabase = await createClient();
  const [{ data: addons }, { data: groups }] = await Promise.all([
    supabase.from("product_addons").select("id,product_id,name,price_cents,active,group_id")
      .eq("store_id", store_id).eq("active", true),
    supabase.from("product_addon_groups").select("id,name,required,max_choices,sort_order")
      .eq("store_id", store_id).order("sort_order"),
  ]);
  return {
    addons: (addons ?? []) as { id: string; product_id: string | null; name: string; price_cents: number; active: boolean; group_id: string | null }[],
    groups: (groups ?? []) as AddonGroupRow[],
  };
}
