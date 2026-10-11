// Operações puras da sacola + persistência localStorage por slug (spec §4: cart.ts).
// Linha = mesmo produto + mesmos adicionais + mesma obs. Só client importa daqui.
export type CartLine = { productId: string; addonIds: string[]; notes: string; qty: number };

export const MAX_LINES = 30; // spec: máx 30 linhas por pedido
export const MAX_QTY = 20; // spec: qty 1..20

const key = (slug: string) => `kero:cart:v1:${slug}`;
const sameAddons = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  if (lines.length >= MAX_LINES) return lines;
  const i = lines.findIndex(
    (l) => l.productId === line.productId && sameAddons(l.addonIds, line.addonIds) && l.notes === line.notes
  );
  if (i >= 0) {
    const next = [...lines];
    next[i] = { ...next[i], qty: Math.min(MAX_QTY, next[i].qty + line.qty) };
    return next;
  }
  return [...lines, { ...line, qty: Math.min(MAX_QTY, Math.max(1, line.qty)) }];
}

export function setQty(lines: CartLine[], index: number, qty: number): CartLine[] {
  if (qty <= 0) return lines.filter((_, i) => i !== index);
  return lines.map((l, i) => (i === index ? { ...l, qty: Math.min(MAX_QTY, qty) } : l));
}

export function removeLine(lines: CartLine[], index: number): CartLine[] {
  return lines.filter((_, i) => i !== index);
}

export function countItems(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}

export function loadCart(slug: string): CartLine[] {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed)
      ? parsed.filter((l) => typeof l.productId === "string" && l.qty > 0).slice(0, MAX_LINES)
      : [];
  } catch {
    return [];
  }
}

export function saveCart(slug: string, lines: CartLine[]): void {
  try {
    localStorage.setItem(key(slug), JSON.stringify(lines));
  } catch {
    // storage cheio/bloqueado: sacola segue só em memória
  }
}

// C-08: último tracking_token no aparelho (sem conta de cliente, sem histórico
// no servidor) — a vitrine oferece "Acompanhar pedido" a partir daqui.
const lastKey = (slug: string) => `kero:last-order:v1:${slug}`;

export function saveLastToken(slug: string, token: string): void {
  try {
    localStorage.setItem(lastKey(slug), token);
  } catch {
    // storage cheio/bloqueado: acompanhamento segue só pela URL atual
  }
}

export function loadLastToken(slug: string): string | null {
  try {
    return localStorage.getItem(lastKey(slug));
  } catch {
    return null;
  }
}
