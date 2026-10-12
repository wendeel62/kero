// Tipos + puros do painel (sem "use server" — clients podem importar daqui).
// Ações de leitura vivem em ./painel (server), mutações em ./painel-actions.
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

export { STATUS_LABEL };
export type PanelStatus = OrderStatus;
export type PanelType = "delivery" | "pickup";

export const PAYMENT_PT: Record<string, string> = { cash: "Dinheiro", pix: "Pix", card_machine: "Maquininha" };

export type PanelOrder = {
  id: string; code: string; customer: string; minutesAgo: number;
  type: PanelType; payment: string; total_cents: number; status: PanelStatus;
  statusMinutes: number;
};

// meia-noite de Manaus em ISO UTC (Manaus = UTC-4 fixo, sem horário de verão)
export const manausDayStartISO = (now = new Date()) => {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  return new Date(`${day}T04:00:00Z`).toISOString();
};

// linha de orders (SELECTs do painel + payload do Realtime) → PanelOrder.
// minutesAgo resolvido pelo caller (servidor nas actions, browser no live).
export type PanelRow = {
  id: string; code: string; customer_name: string; type: PanelType;
  payment_method: string; total_cents: number; status: PanelStatus; created_at: string;
};

export const toPanelOrder = (o: PanelRow, now = Date.now(), statusMinutes?: number): PanelOrder => ({
  id: o.id, code: o.code, customer: o.customer_name,
  minutesAgo: Math.max(0, Math.round((now - new Date(o.created_at).getTime()) / 60000)),
  type: o.type, payment: PAYMENT_PT[o.payment_method] ?? o.payment_method,
  total_cents: o.total_cents, status: o.status,
  statusMinutes: statusMinutes ?? Math.max(0, Math.round((now - new Date(o.created_at).getTime()) / 60000)),
});

export type PanelItem = { name: string; qty: number; unit: number; addons: string[]; notes: string };
export type PanelEvent = { label: string; actor: string; at: string };
export type PanelAddress = {
  street?: string; number?: string; complement?: string | null;
  cep?: string; neighborhood_name?: string;
} | null;

export type PanelDetail = PanelOrder & {
  phone: string; paymentMethod: string; changeFor: number | null; notes: string | null;
  address: PanelAddress; subtotal: number; fee: number; trackingToken: string;
  store: { name: string; slug: string; whatsapp: string };
  items: PanelItem[]; events: PanelEvent[];
};

export type PanelProduct = {
  id: string; name: string; description: string; price_cents: number;
  image_url: string | null; active: boolean; sort_order: number; category_id: string;
};
export type PanelCategory = { id: string; name: string; active: boolean; sort_order: number; products: PanelProduct[] };
export type PanelAddon = { id: string; name: string; price_cents: number; active: boolean; group_id: string | null };
export type CardapioData = {
  storeId: string; categories: PanelCategory[]; addons: PanelAddon[]; addonIdsByProduct: Map<string, string[]>;
};

export type FichaData = {
  storeId: string;
  categories: { id: string; name: string }[];
  product: {
    id: string; name: string; description: string; price_cents: number;
    category_id: string; sort_order: number; active: boolean; image_url: string | null;
  } | null;
  globalAddons: { id: string; name: string; price_cents: number }[];
  linkedAddonIds: string[];
};

export type PanelSettings = {
  storeId: string;
  name: string; whatsapp: string; description: string; pix_key: string; logo_url: string | null;
  marquee_text: string; cover_url: string | null;
  min_order_cents: number; prep_time_min: number | null; prep_time_max: number | null;
  open_hours: Record<string, [string, string][]>;
  hoods: { id: string; name: string; fee_cents: number; active: boolean }[];
  tables: { id: string; number: number; label: string; active: boolean }[];
  occupiedTableIds: string[];
  fb_pixel_id: string | null;
  ga4_id: string | null;
};
