// Espelho TS da matemática de preço do RPC create_order (SPEC §2.10/§2.9; 002 l.431–448).
// A SQL é a autoridade no servidor; isto serve a UI e validações client-side.
export type PricingItem = { price_cents: number; qty: number; addons?: number[] }; // addons = preços em centavos

export function unitPrice(item: PricingItem): number {
  return item.price_cents + (item.addons ?? []).reduce((a, b) => a + b, 0);
}

// qty com clamp 1..20 como no RPC (002 l.448)
export function lineTotal(item: PricingItem): number {
  return unitPrice(item) * Math.min(Math.max(item.qty || 1, 1), 20);
}

export function subtotal(items: PricingItem[]): number {
  return items.reduce((s, i) => s + lineTotal(i), 0);
}

export function total(subtotalCents: number, deliveryFeeCents: number): number {
  return subtotalCents + deliveryFeeCents;
}

// Pedido mínimo sobre o SUBTOTAL (SPEC §2.20)
export function meetsMinimum(subtotalCents: number, minOrderCents: number): boolean {
  return subtotalCents >= minOrderCents;
}

// "49,90" | "1.234,56" | "R$ 10,00" → centavos int; inválido/negativo → NaN
export function parseBRLToCents(raw: string): number {
  const digits = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0 || digits === "") return NaN;
  return Math.round(n * 100);
}

// Troco (SPEC §2.30): cash exige change_for ≥ total; demais métodos → null. Echo do valor p/ manter o campo na UI.
export function validateChange(
  paymentMethod: string,
  changeForCents: number | null,
  totalCents: number
): { ok: boolean; changeForCents: number | null } {
  if (paymentMethod !== "cash") return { ok: true, changeForCents: null };
  return { ok: changeForCents !== null && changeForCents >= totalCents, changeForCents };
}
