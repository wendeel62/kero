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
import { parsePeriodKind, resolvePeriod, type CustomRange } from "./period";
import { minutesInStatus } from "./order-timing";
import { aggregateCustomers, type Customer } from "./customers";
import { goalProgress, windowFor, type GoalPeriod } from "./goals";
import type { AddonGroupRow } from "./addon-groups";
import { activeTableOrder } from "./pdv";
import { entregasEmAndamento } from "./kpis";
import { boardColumns, courierOnRoute, mapPoints } from "./deliveries";

const ORDER_COLS = "id,code,customer_name,type,payment_method,total_cents,status,created_at";

export async function getHoje(period: string = "today", range: CustomRange = {}) {
  const { supabase, storeId } = await requireStore();
  const now = Date.now();
  const { from, to } = resolvePeriod(parsePeriodKind(period), range);
  const [{ data: store }, { data: rows }] = await Promise.all([
    supabase.from("stores").select("name,force_closed,force_closed_at").eq("id", storeId).single(),
    supabase.from("orders").select(ORDER_COLS).eq("store_id", storeId)
      .gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false }),
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
      entregasAndamento: entregasEmAndamento(orders),
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
  const [{ data: cats }, { data: prods }, { data: addons }, { data: prodAddons }, { data: groups }] = await Promise.all([
    supabase.from("categories").select("id,name,active,sort_order").eq("store_id", storeId).order("sort_order"),
    supabase.from("products").select("id,category_id,name,description,price_cents,image_url,active,sort_order")
      .eq("store_id", storeId).order("sort_order"),
    supabase.from("product_addons").select("id,name,price_cents,active,group_id")
      .eq("store_id", storeId).is("product_id", null),
    supabase.from("product_addons").select("id,product_id").eq("store_id", storeId).not("product_id", "is", null),
    supabase.from("product_addon_groups").select("id,name,required,max_choices,sort_order")
      .eq("store_id", storeId).order("sort_order"),
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
    addons: ((addons ?? []) as (PanelAddon & { group_id: string | null })[]).map((a) => ({ ...a })),
    groups: ((groups ?? []) as AddonGroupRow[]),
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
  const [{ data: store }, { data: hoods }, { data: tables }, { data: busyOrders }, { data: tracking }] = await Promise.all([
    supabase.from("stores").select("name,whatsapp,description,pix_key,logo_url,marquee_text,cover_url,min_order_cents,prep_time_min,prep_time_max,open_hours")
      .eq("id", storeId).single(),
    supabase.from("neighborhoods").select("id,name,fee_cents,active").eq("store_id", storeId).order("name"),
    supabase.from("dine_tables").select("id,number,label,active").eq("store_id", storeId).order("number"),
    supabase.from("orders").select("table_id").eq("store_id", storeId)
      .in("status", ["new", "confirmed", "preparing", "ready", "out"])
      .not("table_id", "is", null),
    supabase.from("store_tracking").select("fb_pixel_id,ga4_id").eq("store_id", storeId).single(),
  ]);
  const occupiedTableIds = ((busyOrders ?? []) as { table_id: string }[]).map((o) => o.table_id);
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
      tables: ((tables ?? []) as PanelSettings["tables"]).map((t) => ({ ...t })),
      occupiedTableIds,
      fb_pixel_id: (tracking?.fb_pixel_id as string | null) ?? null,
      ga4_id: (tracking?.ga4_id as string | null) ?? null,
    },
  };
}
// Kanban (DS §8.7): pedidos criados no período escolhido + coluna "Anteriores"
// (D7): não finalizados criados antes do início do período. Tempo no status atual
// derivado de order_events (C1) — nunca gravado, sempre calculado.
export async function getKanban(period: string = "today", type: string = "all", range: CustomRange = {}) {
  const { supabase, storeId } = await requireStore();
  const now = Date.now();
  const { from, to } = resolvePeriod(parsePeriodKind(period), range);

  const cols = (q: ReturnType<typeof supabase.from>) => q.select(ORDER_COLS).eq("store_id", storeId);
  let periodo = cols(supabase.from("orders")).gte("created_at", from).lt("created_at", to);
  if (type === "delivery" || type === "pickup") periodo = periodo.eq("type", type);
  const { data: rows, error: e1 } = await periodo.order("created_at", { ascending: true });
  if (e1) throw new Error(e1.message); // design C5: nunca engolir

  // "Anteriores" (D7): não finalizados criados ANTES do início do período.
  const NAO_FINALIZADOS = "new,confirmed,preparing,ready,out";
  let antigosQ = cols(supabase.from("orders"))
    .lt("created_at", from).in("status", NAO_FINALIZADOS.split(","));
  if (type === "delivery" || type === "pickup") antigosQ = antigosQ.eq("type", type);
  const { data: antigos, error: e2 } = await antigosQ.order("created_at", { ascending: true });
  if (e2) throw new Error(e2.message);

  const orders = [...((rows ?? []) as PanelRow[])];
  const anteriores = ((antigos ?? []) as PanelRow[]);

  // eventos dos pedidos que mostram tempo-no-status (do período e anteriores)
  const ids = [...orders, ...anteriores]
    .filter((o) => !["new", "delivered", "cancelled"].includes(o.status)).map((o) => o.id);
  const { data: events, error: e3 } = ids.length
    ? await supabase.from("order_events").select("order_id,to_status,created_at").in("order_id", ids)
    : { data: [] as { order_id: string; to_status: string; created_at: string }[], error: null };
  if (e3) throw new Error(e3.message);
  const byOrder = new Map<string, { to_status: string; created_at: string }[]>();
  for (const e of events ?? []) byOrder.set(e.order_id, [...(byOrder.get(e.order_id) ?? []), e]);

  const mapped = orders.map((o) =>
    toPanelOrder(o, now, minutesInStatus(byOrder.get(o.id) ?? [], o.status, o.created_at, now))
  );
  // `cancelled` NÃO é devolvido: a página deriva de `orders` (uma fonte só), e o
  // Realtime atualiza `orders` localmente — devolver o campo criaria duas fontes.
  return {
    orders: mapped,
    anteriores: anteriores.map((o) =>
      toPanelOrder(o, now, minutesInStatus(byOrder.get(o.id) ?? [], o.status, o.created_at, now))
    ),
  };
}

// Clientes (design D3): agrega o histórico inteiro da loja. Teto de 1000 linhas
// mais recentes — acima disso a lista fica parcial.
// ponytail: agrega no servidor sobre 1000 pedidos; se a loja passar disso, trocar
// por uma view materializada.
export async function getClientes(): Promise<{ customers: Customer[] }> {
  const { supabase, storeId } = await requireStore();
  const { data, error } = await supabase.from("orders")
    .select("customer_name,customer_phone,total_cents,status,created_at")
    .eq("store_id", storeId).order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message); // design C5: nunca engolir
  return { customers: aggregateCustomers((data ?? []) as { customer_name: string; customer_phone: string; total_cents: number; status: string; created_at: string }[]) };
}

export async function getPedidosDoCliente(phone: string): Promise<{ orders: PanelRow[] }> {
  const { supabase, storeId } = await requireStore();
  const { data, error } = await supabase.from("orders")
    .select(ORDER_COLS)
    .eq("store_id", storeId).eq("customer_phone", phone)
    .order("created_at", { ascending: false }).limit(10);
  if (error) throw new Error(error.message);
  return { orders: (data ?? []) as PanelRow[] };
}

// Contexto do live (kanban): só o store_id p/ assinar o canal orders:{storeId}.
export async function getRealtimeContext() {
  const { storeId } = await requireStore();
  return { storeId };
}

// Relatorios (design C1): faturamento do periodo + mais vendidos + metas.
// Uma passada em orders + uma em order_items; sem tabela derivada.
export async function getRelatorios(period: string = "7d", range: CustomRange = {}) {
  const { supabase, storeId } = await requireStore();
  const { from, to } = resolvePeriod(parsePeriodKind(period), range);

  const { data: orders, error: e1 } = await supabase.from("orders")
    .select("id,total_cents,status,created_at").eq("store_id", storeId)
    .gte("created_at", from).lt("created_at", to);
  if (e1) throw new Error(e1.message);

  const validos = (orders ?? []).filter((o) => o.status !== "cancelled");
  const revenueCents = validos.reduce((s, o) => s + o.total_cents, 0);
  const ticketCents = validos.length ? Math.round(revenueCents / validos.length) : 0;

  // order_items dos pedidos do período numa leitura só (o filtro vai no embed,
  // não numa lista de ids — que estouraria a URL com muitos pedidos).
  const { data: items, error: e2 } = await supabase.from("order_items")
    .select("name_snapshot,qty,unit_price_cents,orders!inner(store_id,status,created_at)")
    .eq("orders.store_id", storeId)
    .neq("orders.status", "cancelled")
    .gte("orders.created_at", from).lt("orders.created_at", to);
  if (e2) throw new Error(e2.message);

  const topMap = new Map<string, { qty: number; cents: number }>();
  for (const it of items ?? []) {
    const cur = topMap.get(it.name_snapshot) ?? { qty: 0, cents: 0 };
    cur.qty += it.qty; cur.cents += it.qty * it.unit_price_cents;
    topMap.set(it.name_snapshot, cur);
  }
  const topProducts = [...topMap.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, cents: v.cents }))
    .sort((a, b) => b.cents - a.cents).slice(0, 10);

  const { data: goals, error: e3 } = await supabase.from("sales_goals")
    .select("period,target_cents").eq("store_id", storeId);
  if (e3) throw new Error(e3.message);

  // faturamento de cada janela de meta, por periodo (1 query por janela distinta)
  const metas: { period: GoalPeriod; targetCents: number; revenueCents: number; percent: number }[] = [];
  for (const g of (goals ?? []) as { period: GoalPeriod; target_cents: number }[]) {
    const w = windowFor(g.period);
    const { data: janela, error: e4 } = await supabase.from("orders")
      .select("total_cents,status").eq("store_id", storeId)
      .gte("created_at", w.from).lt("created_at", w.to).neq("status", "cancelled");
    if (e4) throw new Error(e4.message);
    const revenue = (janela ?? []).reduce((s, o) => s + o.total_cents, 0);
    const p = goalProgress(g.target_cents, revenue);
    if (p) metas.push({ period: g.period, targetCents: g.target_cents, revenueCents: revenue, percent: p.percent });
  }

  return { from, to, revenueCents, ticketCents, count: validos.length, topProducts, metas };
}

// PDV (recon §3): products ativos, addons, mesas e pedidos não finalizados.
export async function getPdv() {
  const { supabase, storeId } = await requireStore();
  const [{ data: prods }, { data: addons }, { data: tables }, { data: orders }] = await Promise.all([
    supabase.from("products").select("id,name,price_cents").eq("store_id", storeId).eq("active", true).order("sort_order"),
    supabase.from("product_addons").select("id,name,price_cents").eq("store_id", storeId).eq("active", true),
    supabase.from("dine_tables").select("id,number,label,active").eq("store_id", storeId).order("number"),
    supabase.from("orders").select("table_id,status").eq("store_id", storeId)
      .in("status", ["new", "confirmed", "preparing", "ready", "out"])
      .not("table_id", "is", null),
  ]);
  const tableIds = ((tables ?? []) as { id: string }[]).map((t) => t.id);
  const activeByTable = activeTableOrder(
    tableIds,
    (orders ?? []) as { table_id: string | null; status: string }[]
  );
  return {
    products: (prods ?? []) as { id: string; name: string; price_cents: number }[],
    addons: (addons ?? []) as { id: string; name: string; price_cents: number }[],
    tables: (tables ?? []) as { id: string; number: string; label: string | null; active: boolean }[],
    activeByTable,
  };
}

// Entregas (recon §4, sem mapa): prontas/em rota/concluídas hoje + couriers ativos.
export async function getEntregas() {
  const { supabase, storeId } = await requireStore();
  const [{ data: orders }, { data: couriers }, { data: routes }, { data: courierPositions }] = await Promise.all([
    supabase.from("orders").select(ORDER_COLS + ",address").eq("store_id", storeId)
      .in("status", ["ready", "out", "delivered"])
      .gte("created_at", manausDayStartISO()).order("created_at", { ascending: false }),
    supabase.from("couriers").select("id,name,phone,active,user_id").eq("store_id", storeId).eq("active", true).order("name"),
    supabase.from("routes").select("id,courier_id,status").eq("store_id", storeId).eq("status", "open"),
    supabase.from("courier_positions").select("courier_id,lat,lng,atualizado_em,couriers(name)").eq("store_id", storeId),
  ]);
  const now = Date.now();
  const routesList = (routes ?? []) as { id: string; courier_id: string; status: string }[];
  const routeIds = routesList.map((r) => r.id);
  const { data: stops } = await supabase.from("route_stops").select("route_id,order_id").in("route_id", routeIds.length ? routeIds : ["00000000-0000-0000-0000-000000000000"]);
  const orderCourier = new Map<string, string>();
  for (const r of routesList) {
    for (const s of (stops ?? []) as { route_id: string; order_id: string }[]) {
      if (s.route_id === r.id) orderCourier.set(s.order_id, r.courier_id);
    }
  }
  const panelOrders = ((orders ?? []) as unknown as PanelRow[]).map((o) => toPanelOrder(o, now, undefined, orderCourier.get(o.id)));
  const cols = boardColumns(panelOrders);
  const onRoute = courierOnRoute(
    (couriers ?? []) as { id: string }[],
    routesList,
  );
  const routeIdPorCourier: Record<string, string> = {};
  for (const r of routesList) routeIdPorCourier[r.courier_id] = r.id;
  const outOrders = ((orders ?? []) as unknown as PanelRow[]).filter((o) => o.status === "out");
  return {
    prontas: panelOrders.filter((o) => o.status === "ready"),
    emRota: panelOrders.filter((o) => o.status === "out"),
    concluidas: panelOrders.filter((o) => o.status === "delivered"),
    counts: cols,
    couriers: ((couriers ?? []) as { id: string; name: string; phone: string; active: boolean; user_id: string | null }[]).map((c) => ({ ...c, vinculado: c.user_id != null })),
    courierOnRoute: onRoute,
    routeIdPorCourier,
    mapPoints: mapPoints(outOrders as unknown as { id: string; code: string; status: string; address: unknown }[]),
    courierPositions: ((courierPositions ?? []) as { courier_id: string; lat: number; lng: number; atualizado_em: string; couriers: { name: string }[] }[])
      .map((p) => ({ courierId: p.courier_id, nome: p.couriers[0]?.name ?? "", lat: p.lat, lng: p.lng, atualizadoEm: p.atualizado_em })),
  };
}

// Financeiro (recon §5): faturamento válido do período (exclui cancelados),
// sessão de caixa aberta + movimentos, contas com payableStatus e netRevenue.
import { cashSummary, payableStatus, netRevenue, type CashMovement } from "./finance";

export async function getFinanceiro(period: string = "7d", range: CustomRange = {}) {
  const { supabase, storeId } = await requireStore();
  const { from, to } = resolvePeriod(parsePeriodKind(period), range);

  // faturamento válido do período (exclui cancelados — mesma query de getRelatorios)
  const { data: orders, error: e1 } = await supabase.from("orders")
    .select("id,total_cents,status,created_at").eq("store_id", storeId)
    .gte("created_at", from).lt("created_at", to);
  if (e1) throw new Error(e1.message);
  const validos = (orders ?? []).filter((o) => o.status !== "cancelled");
  const revenueCents = validos.reduce((s, o) => s + o.total_cents, 0);

  // despesas pagas no período (contas marcadas paid_at no período)
  const { data: paidAccts, error: e2 } = await supabase.from("payable_accounts")
    .select("paid_cents").eq("store_id", storeId).eq("paid", true)
    .gte("paid_at", from).lt("paid_at", to);
  if (e2) throw new Error(e2.message);
  const paidExpensesCents = (paidAccts ?? []).reduce((s, a) => s + (a.paid_cents ?? 0), 0);

  // caixa: sessão aberta + movimentos da loja
  const { data: sessions } = await supabase.from("cash_sessions")
    .select("id,opening_cents,opened_at,closed_at,closed_cents")
    .eq("store_id", storeId).order("opened_at", { ascending: false }).limit(1);
  const openSession = (sessions ?? []).find((s) => s.closed_at === null) ?? null;
  let movements: CashMovement[] = [];
  if (openSession) {
    const { data: movs } = await supabase.from("cash_movements")
      .select("direction,amount_cents,note,created_at")
      .eq("store_id", storeId).eq("session_id", openSession.id)
      .order("created_at", { ascending: true });
    movements = (movs ?? []) as CashMovement[];
  }
  const todayISO = new Date().toISOString().slice(0, 10);
  const salesCentsToday = (() => {
    // faturamento válido de HOJE (para o saldo esperado do caixa)
    const dayStart = new Date(manausDayStartISO(new Date()));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000).toISOString();
    return validos
      .filter((o) => o.created_at >= dayStart.toISOString() && o.created_at < dayEnd)
      .reduce((s, o) => s + o.total_cents, 0);
  })();

  const { data: contas } = await supabase.from("payable_accounts")
    .select("id,description,amount_cents,due_date,paid,paid_at,paid_cents")
    .eq("store_id", storeId).order("due_date", { ascending: true });
  const payable = (contas ?? []).map((c) => ({
    ...c,
    status: payableStatus({ paid: c.paid, due_date: c.due_date }, todayISO),
  }));

  return {
    from, to,
    revenueCents,
    paidExpensesCents,
    netRevenueCents: netRevenue(revenueCents, paidExpensesCents),
    cash: openSession
      ? {
          session: openSession,
          movements,
          summary: cashSummary(
            { opening_cents: openSession.opening_cents, closing_cents: openSession.closed_cents },
            movements,
            salesCentsToday,
          ),
        }
      : null,
    payable,
  };
}
