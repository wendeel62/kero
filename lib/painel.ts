// Leituras do painel lojista (M5) — Server Actions: "hoje" e agregados resolvidos
// no SERVIDOR (fuso America/Manaus); RLS do lojista via requireStore.
"use server";

import { requireStore } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/order-status";
import type {
  FichaData, PanelAddon, PanelAddress, PanelDetail,
  PanelProduct, PanelRow, PanelSettings, PanelStatus,
} from "./painel-utils";
import { manausDayStartISO, toPanelOrder } from "./painel-utils";

const ORDER_COLS = "id,code,customer_name,type,payment_method,total_cents,status,created_at";

export async function getHoje() {
  const { supabase, storeId } = await requireStore();
  const now = Date.now();
  const [{ data: store }, { data: rows }] = await Promise.all([
    supabase.from("stores").select("name,force_closed,force_closed_at").eq("id", storeId).single(),
    supabase.from("orders").select(ORDER_COLS).eq("store_id", storeId)
      .gte("created_at", manausDayStartISO()).order("created_at", { ascending: false }),
  ]);
  if (!store) throw new Error("Loja não encontrada.");
  const orders = ((rows ?? []) as PanelRow[]).map((o) => toPanelOrder(o, now));
  const valid = orders.filter((o) => o.status !== "cancelled");
  const revenue = valid.reduce((s, o) => s + o.total_cents, 0);
  return {
    storeName: store.name as string,
    closed: store.force_closed as boolean,
    closedAt: store.force_closed_at as string | null,
    stats: {
      count: valid.length, revenue,
      ticket: valid.length ? Math.round(revenue / valid.length) : 0,
      awaiting: orders.filter((o) => o.status === "new").length,
    },
    recent: orders.slice(0, 5),
  };
}

export async function getAwaitingCount() {
  const { supabase, storeId } = await requireStore();
  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true })
    .eq("store_id", storeId).eq("status", "new").gte("created_at", manausDayStartISO());
  return { awaiting: count ?? 0 };
}

export async function getStoreName() {
  const { supabase, storeId } = await requireStore();
  const { data } = await supabase.from("stores").select("name").eq("id", storeId).single();
  return { storeName: (data?.name as string) ?? "Kero" };
}

// Status da vitrine p/ topbar: slug + aberto/fechado (1 query).
export async function getStoreStatus() {
  const { supabase, storeId } = await requireStore();
  const { data } = await supabase.from("stores").select("name,slug,force_closed").eq("id", storeId).single();
  return {
    name: (data?.name as string) ?? "Kero",
    slug: (data?.slug as string) ?? "",
    closed: (data?.force_closed as boolean) ?? false,
  };
}

// Detalhe (DS §8.8): pedido + snapshot de itens + linha do tempo de eventos.
const ACTOR_PT: Record<string, string> = { customer: "cliente", store: "loja", system: "sistema" };

export async function getPedido(id: string): Promise<{ order: PanelDetail | null }> {
  const { supabase, storeId } = await requireStore();
  const now = Date.now();
  const { data: o } = await supabase.from("orders").select("id,code,customer_name,customer_phone,type,payment_method,change_for_cents,address,notes,subtotal_cents,delivery_fee_cents,total_cents,status,created_at,tracking_token").eq("id", id).eq("store_id", storeId).single();
  if (!o) return { order: null };
  const [{ data: items }, { data: events }, { data: store }] = await Promise.all([
    supabase.from("order_items").select("name_snapshot,unit_price_cents,qty,addons,notes").eq("order_id", id),
    supabase.from("order_events").select("to_status,actor,created_at").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("stores").select("name,slug,whatsapp").eq("id", storeId).single(),
  ]);
  return {
    order: {
      ...toPanelOrder(o as unknown as PanelRow, now),
      phone: o.customer_phone as string,
      paymentMethod: o.payment_method as string,
      changeFor: (o.change_for_cents as number | null) ?? null,
      notes: (o.notes as string | null) ?? null,
      address: (o.address as PanelAddress) ?? null,
      subtotal: o.subtotal_cents as number,
      fee: o.delivery_fee_cents as number,
      trackingToken: o.tracking_token as string,
      store: {
        name: (store?.name as string) ?? "",
        slug: (store?.slug as string) ?? "",
        whatsapp: (store?.whatsapp as string) ?? "",
      },
      items: ((items ?? []) as { name_snapshot: string; unit_price_cents: number; qty: number; addons: { name: string }[]; notes: string | null }[])
        .map((it) => ({
          name: it.name_snapshot, qty: it.qty, unit: it.unit_price_cents,
          addons: (it.addons ?? []).map((a) => a.name), notes: it.notes ?? "",
        })),
      events: ((events ?? []) as { to_status: PanelStatus; actor: string; created_at: string }[])
        .map((e) => ({ label: STATUS_LABEL[e.to_status] ?? e.to_status, actor: ACTOR_PT[e.actor] ?? e.actor, at: e.created_at })),
    },
  };
}
// Cardápio (DS §8.10): categorias + produtos + adicionais globais, tudo da loja,
// ordenado por sort_order (persistido no banco, não no cliente).
export async function getCardapio() {
  const { supabase, storeId } = await requireStore();
  const [{ data: cats }, { data: prods }, { data: addons }, { data: prodAddons }] = await Promise.all([
    supabase.from("categories").select("id,name,active,sort_order").eq("store_id", storeId).order("sort_order"),
    supabase.from("products").select("id,category_id,name,description,price_cents,image_url,active,sort_order")
      .eq("store_id", storeId).order("sort_order"),
    supabase.from("product_addons").select("id,name,price_cents,active")
      .eq("store_id", storeId).is("product_id", null),
    supabase.from("product_addons").select("id,product_id").eq("store_id", storeId).not("product_id", "is", null),
  ]);
  const byCat = new Map<string, PanelProduct[]>();
  const addonIdsByProduct = new Map<string, string[]>();
  for (const p of (prods ?? []) as (PanelProduct & { category_id: string })[]) {
    const list = byCat.get(p.category_id) ?? [];
    list.push({
      id: p.id, name: p.name, description: p.description ?? "", price_cents: p.price_cents,
      image_url: p.image_url, active: p.active, sort_order: p.sort_order, category_id: p.category_id,
    });
    byCat.set(p.category_id, list);
  }
  for (const a of (prodAddons ?? []) as { id: string; product_id: string }[]) {
    const list = addonIdsByProduct.get(a.product_id) ?? [];
    list.push(a.id);
    addonIdsByProduct.set(a.product_id, list);
  }
  return {
    storeId,
    categories: ((cats ?? []) as { id: string; name: string; active: boolean; sort_order: number }[]).map((c) => ({
      ...c, products: byCat.get(c.id) ?? [],
    })),
    addons: ((addons ?? []) as PanelAddon[]).map((a) => ({ ...a })),
    addonIdsByProduct,
  };
}

// Ficha do produto (DS §8.11): `novo` abre em branco, id abre preenchido.
export async function getFicha(id: string): Promise<{ ficha: FichaData | null }> {
  const { supabase, storeId } = await requireStore();
  const isNew = id === "novo";
  const [{ data: cats }, { data: globals }, prodRes, linksRes] = await Promise.all([
    supabase.from("categories").select("id,name").eq("store_id", storeId).order("sort_order"),
    supabase.from("product_addons").select("id,name,price_cents").eq("store_id", storeId).is("product_id", null),
    isNew
      ? Promise.resolve({ data: null })
      : supabase.from("products").select("id,name,description,price_cents,category_id,sort_order,active,image_url")
          .eq("id", id).eq("store_id", storeId).single(),
    isNew
      ? Promise.resolve({ data: [] })
      : supabase.from("product_addons").select("name,price_cents").eq("store_id", storeId).eq("product_id", id),
  ]);
  if (!isNew && !prodRes.data) return { ficha: null };
  const p = prodRes.data as FichaData["product"];
  const globalList = (globals ?? []) as { id: string; name: string; price_cents: number }[];
  const linked = ((linksRes.data ?? []) as { name: string; price_cents: number }[])
    .flatMap((l) => globalList.filter((g) => g.name === l.name && g.price_cents === l.price_cents).map((g) => g.id));
  return {
    ficha: {
      storeId,
      categories: (cats ?? []) as { id: string; name: string }[],
      product: p ? {
        id: p.id, name: p.name, description: p.description ?? "", price_cents: p.price_cents,
        category_id: p.category_id, sort_order: p.sort_order, active: p.active, image_url: p.image_url,
      } : null,
      globalAddons: globalList,
      linkedAddonIds: linked,
    },
  };
}
// Configurações (DS §8.12): linha da loja + bairros; salvamento é por aba nas actions.
export async function getSettings(): Promise<{ settings: PanelSettings | null }> {
  const { supabase, storeId } = await requireStore();
  const [{ data: store }, { data: hoods }] = await Promise.all([
    supabase.from("stores").select("name,whatsapp,description,pix_key,logo_url,marquee_text,cover_url,min_order_cents,prep_time_min,prep_time_max,open_hours")
      .eq("id", storeId).single(),
    supabase.from("neighborhoods").select("id,name,fee_cents,active").eq("store_id", storeId).order("name"),
  ]);
  if (!store) return { settings: null };
  return {
    settings: {
      storeId,
      name: (store.name as string) ?? "", whatsapp: (store.whatsapp as string) ?? "",
      description: (store.description as string | null) ?? "", pix_key: (store.pix_key as string | null) ?? "",
      logo_url: (store.logo_url as string | null) ?? null,
      marquee_text: (store.marquee_text as string | null) ?? "",
      cover_url: (store.cover_url as string | null) ?? null,
      min_order_cents: (store.min_order_cents as number) ?? 0,
      prep_time_min: (store.prep_time_min as number | null) ?? null,
      prep_time_max: (store.prep_time_max as number | null) ?? null,
      open_hours: (store.open_hours as PanelSettings["open_hours"]) ?? {},
      hoods: ((hoods ?? []) as PanelSettings["hoods"]).map((h) => ({ ...h })),
    },
  };
}
// Kanban (DS §8.7): janela = não finalizados + hoje, com "hoje" resolvido AQUI
// (servidor, America/Manaus) — nunca no cliente.
export async function getKanban() {
  const { supabase, storeId } = await requireStore();
  const now = Date.now();
  const { data: rows } = await supabase.from("orders").select(ORDER_COLS).eq("store_id", storeId)
    .or(`status.in.(new,confirmed,preparing,ready,out),created_at.gte.${manausDayStartISO()}`)
    .order("created_at", { ascending: true });
  const orders = ((rows ?? []) as PanelRow[]).map((o) => toPanelOrder(o, now));
  return { orders, cancelled: orders.filter((o) => o.status === "cancelled") };
}

// Contexto do live (kanban): só o store_id p/ assinar o canal orders:{storeId}.
export async function getRealtimeContext() {
  const { storeId } = await requireStore();
  return { storeId };
}
