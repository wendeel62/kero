import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { calcularQuote } from "@/lib/storefront-quote";
import { createAdminClient } from "@/lib/supabase/admin";

// Quote da vitrine (paridade com POST /api/checkout/quote do original).
// Preços e grupos resolvidos no banco; cliente nunca dita total.
// Taxa delivery = menor taxa ativa da loja (bairros não têm zona/CEP).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  }
  if (typeof body !== "object" || body === null) return apiError("INVALID_BODY", "Dados inválidos.", 400);
  const b = body as { slug?: unknown; tipo?: unknown; items?: Array<{ productId?: unknown; qtd?: unknown; addonIds?: unknown }> };

  if (typeof b.slug !== "string" || !b.slug) return apiError("INVALID_BODY", "Loja inválida.", 400);
  if (typeof b.tipo !== "string" || !["delivery", "retirada", "mesa"].includes(b.tipo)) {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }
  if (!Array.isArray(b.items)) return apiError("INVALID_BODY", "Itens inválidos.", 400);

  const admin = createAdminClient();
  const { data: store } = await admin.from("stores").select("id, active, force_closed").eq("slug", b.slug).single();
  if (!store) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const [{ data: prods }, { data: groups }, { data: addons }, { data: fees }] = await Promise.all([
    admin.from("products").select("id, price_cents, active").eq("store_id", store.id),
    admin.from("product_addon_groups").select("id, required, max_choices").eq("store_id", store.id),
    admin.from("product_addons").select("id, product_id, price_cents, active, group_id").eq("store_id", store.id).eq("active", true),
    admin.from("neighborhoods").select("fee_cents").eq("store_id", store.id).eq("active", true),
  ]);

  try {
    const lines = b.items.map((it) => {
      const p = (prods ?? []).find((x) => x.id === it.productId);
      if (!p) throw new Error("produto_nao_encontrado");
      const ids = Array.isArray(it.addonIds) ? it.addonIds.filter((x): x is string => typeof x === "string") : [];
      const prices: Record<string, number> = {};
      for (const id of ids) {
        const a = (addons ?? []).find((x) => x.id === id && (x.product_id === null || x.product_id === p.id));
        if (!a) throw new Error("opcao_invalida");
        prices[id] = a.price_cents;
      }
      return {
        product: {
          id: p.id,
          price_cents: p.price_cents,
          active: p.active,
          groups: (groups ?? []).map((g) => ({
            id: g.id,
            required: g.required,
            maxChoices: g.max_choices,
            addonIds: (addons ?? []).filter((x) => x.group_id === g.id).map((x) => x.id),
          })),
          addonPrices: prices,
        },
        qty: it.qtd,
        addonIds: ids,
      };
    });
    const feeList = (fees ?? []).map((f) => f.fee_cents);
    const q = calcularQuote({ tipo: b.tipo as string, feeCents: feeList.length ? Math.min(...feeList) : 0, lines: lines as never });
    const names = new Map((await admin.from("products").select("id, name").eq("store_id", store.id)).data?.map((x) => [x.id, x.name] as const) ?? []);
    return NextResponse.json({
      quote: {
        tipo: b.tipo,
        subtotal: q.subtotal / 100,
        taxaEntrega: q.taxaEntrega / 100,
        desconto: 0,
        total: q.total / 100,
        itens: q.itens.map((i) => ({ productId: i.productId, nome: names.get(i.productId) ?? "", qtd: i.qtd, precoUnit: i.precoUnit / 100, total: i.total / 100 })),
      },
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "erro_interno";
    const status = ["tipo_invalido", "itens_invalidos"].includes(code) ? 400 : code === "loja_fechada" ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
