import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Agora fixada para janelas de 30/60 dias determinísticas (America/Manaus = UTC-4, sem DST).
const NOW = new Date("2026-10-16T12:00:00-04:00").getTime();

type Row = Record<string, unknown>;
type QResult = { data: unknown[]; error: { message: string } | null; count?: number | null };

const state = vi.hoisted(() => ({
  failMsg: null as string | null,
  orders: [] as Row[],
  stores: [] as Row[],
}));

vi.mock("@/lib/supabase/admin", () => {
  const aggregate = (cols: string, rows: Row[]): QResult => {
    const mSum = cols.match(/\bsum\((\w+)\)\s*as\s*(\w+)/);
    if (mSum) {
      const total = rows.reduce((s, r) => s + Number(r[mSum[1]] ?? 0), 0);
      return { data: [{ [mSum[2]]: total }], error: null };
    }
    const mCount = cols.match(/\bcount\(\*\)\s*as\s*(\w+)/);
    if (mCount) return { data: [{ [mCount[1]]: rows.length }], error: null };
    return { data: rows, error: null };
  };

  const build = (initialRows: Row[]) => {
    const rows = initialRows;
    const filters: Array<(r: Row) => boolean> = [];
    let cols = "*";
    let wantCount = false;
    let headOnly = false;
    const builder = {
      select: (c: string, opts?: { count?: string; head?: boolean }) => {
        cols = c;
        wantCount = opts?.count === "exact";
        headOnly = opts?.head === true;
        return builder;
      },
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      gte: (col: string, val: unknown) => {
        filters.push((r) => String(r[col]) >= String(val));
        return builder;
      },
      lt: (col: string, val: unknown) => {
        filters.push((r) => String(r[col]) < String(val));
        return builder;
      },
      in: (col: string, vals: unknown[]) => {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      then: (resolve: (v: QResult) => void) => {
        if (state.failMsg) {
          resolve({ data: [], error: { message: state.failMsg } });
          return;
        }
        const out = rows.filter((r) => filters.every((f) => f(r)));
        if (wantCount) {
          resolve({ data: headOnly ? [] : out, error: null, count: out.length });
          return;
        }
        resolve(aggregate(cols, out));
      },
    };
    return builder;
  };

  return {
    createAdminClient: () => ({
      from: (table: string) =>
        build(table === "orders" ? state.orders : state.stores),
    }),
  };
});

async function loadRoute() {
  vi.setSystemTime(NOW);
  vi.resetModules();
  return (await import("@/app/api/admin/metrics/route")).GET;
}

const pedidos: Row[] = [
  { id: "o1", store_id: "A", total_cents: 10000, platform_fee_cents: 500, status: "delivered", created_at: "2026-10-01T10:00:00Z" },
  { id: "o2", store_id: "A", total_cents: 20000, platform_fee_cents: 1000, status: "delivered", created_at: "2026-10-10T10:00:00Z" },
  { id: "o3", store_id: "B", total_cents: 5000, platform_fee_cents: 250, status: "delivered", created_at: "2026-10-12T10:00:00Z" },
  { id: "o4", store_id: "C", total_cents: 99999, platform_fee_cents: 0, status: "cancelled", created_at: "2026-10-13T10:00:00Z" },
  { id: "o5", store_id: "A", total_cents: 100000, platform_fee_cents: 5000, status: "delivered", created_at: "2026-01-01T10:00:00Z" }, // fora da janela: só GMV total
  { id: "o6", store_id: "A", total_cents: 3000, platform_fee_cents: 150, status: "delivered", created_at: "2026-08-20T10:00:00Z" }, // janela anterior
  { id: "o7", store_id: "B", total_cents: 3000, platform_fee_cents: 150, status: "delivered", created_at: "2026-08-25T10:00:00Z" }, // janela anterior + atual
  { id: "o8", store_id: "D", total_cents: 4000, platform_fee_cents: 200, status: "delivered", created_at: "2026-08-30T10:00:00Z" }, // só janela anterior → churn
];

const lojas: Row[] = [
  { id: "A", name: "Loja A", active: true },
  { id: "B", name: "Loja B", active: true },
  { id: "C", name: "Loja C", active: false },
];

describe("GET /api/admin/metrics", () => {
  beforeEach(() => {
    state.failMsg = null;
    state.orders = [...pedidos];
    state.stores = [...lojas];
  });
  afterEach(() => vi.useRealTimers());

  it("200 com todas as métricas", async () => {
    const GET = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(body.gmv_cents).toBe(145000); // todo o tempo, delivered
    expect(body.gmv_cents_30d).toBe(35000); // o1+o2+o3
    expect(body.total_orders_30d).toBe(4); // o1..o4
    expect(body.delivered_orders_30d).toBe(3); // o1..o3
    expect(body.cancelled_orders_30d).toBe(1); // o4
    expect(body.avg_order_value_cents).toBeCloseTo(35000 / 3);
    expect(body.platform_fee_cents_30d).toBe(1750); // 500+1000+250
    expect(body.stores_total).toBe(3);
    expect(body.stores_active).toBe(2);
    expect(body.churn_lojas_30d).toBe(1); // só D teve delivered na janela anterior e não na atual
    expect(body.top_stores).toEqual([
      { store_id: "A", store_name: "Loja A", gmv_cents: 30000, orders_count: 2 },
      { store_id: "B", store_name: "Loja B", gmv_cents: 5000, orders_count: 1 },
    ]);
  });

  it("coluna da Task 1 ausente → 500 descritivo, nunca vazio silencioso", async () => {
    state.failMsg = 'column "platform_fee_cents" does not exist';
    const GET = await loadRoute();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("UNEXPECTED");
    expect(String(body.error.message)).toContain("platform_fee_cents");
  });
});
