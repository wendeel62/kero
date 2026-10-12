// Mutações do painel lojista (M5) — Server Actions sobre RLS do lojista.
// Transição de status usa a API-02 (RPC set_order_status); aqui só escrita direta
// permitida pelo RLS (stores por force_closed, catálogo próprio).
"use server";

import { revalidatePath } from "next/cache";

import { requireStore } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GoalPeriod } from "./goals";
import { sanitizeTrackingId } from "./tracking";


const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function setForceClosed(closed: boolean): Promise<{ ok: boolean; at: string | null; error?: string }> {
  try {
    const { supabase, storeId } = await requireStore();
    const at = closed ? new Date().toISOString() : null;
    const { error } = await supabase.from("stores")
      .update({ force_closed: closed, force_closed_at: at }).eq("id", storeId);
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true, at };
  } catch (e) {
    return { ok: false, at: null, error: err(e) };
  }
}

type R = { ok: boolean; error?: string };

async function mutate(path: string, fn: () => Promise<{ error: unknown; id?: string }>): Promise<R & { id?: string }> {
  try {
    const { error, id } = await fn();
    if (error) throw error;
    revalidatePath(path);
    return { ok: true, id };
  } catch (e) {
    const m = err(e);
    // teto de 200 produtos ativos (trigger) em PT-BR de lojista
    if (m.includes("PRODUCTS_LIMIT")) return { ok: false, error: "Teto de 200 produtos ativos atingido." };
    return { ok: false, error: m };
  }
}

// Cardápio (DS §8.10) — sort_order/active direto via RLS do lojista.
export async function moveCategory(orderedIds: string[]): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase.from("categories")
        .update({ sort_order: i }).eq("id", orderedIds[i]).eq("store_id", storeId);
      if (error) return { error };
    }
    return { error: null };
  });
}

export async function toggleProduct(id: string, active: boolean): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("products").update({ active }).eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

export async function addCategory(name: string, ordem?: number): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { count } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", storeId);
    const { error } = await supabase.from("categories")
      .insert({ store_id: storeId, name: name.trim(), sort_order: ordem ?? count ?? 0 });
    return { error };
  });
}

export async function updateCategory(id: string, input: { name: string; ativo: boolean; ordem: number }): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("categories")
      .update({ name: input.name.trim(), active: input.ativo, sort_order: input.ordem })
      .eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

export async function deleteCategory(id: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("categories").delete().eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

export async function toggleAddon(id: string, active: boolean): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("product_addons").update({ active }).eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

export async function addAddon(name: string, price_cents: number): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("product_addons")
      .insert({ store_id: storeId, product_id: null, name: name.trim(), price_cents });
    return { error };
  });
}

export async function updateAddon(id: string, input: { name: string; price_cents: number; active: boolean }): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("product_addons")
      .update({ name: input.name.trim(), price_cents: input.price_cents, active: input.active })
      .eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

// C-06b: exclusão física do adicional global (histórico preservado: order_items
// guarda snapshot em jsonb, sem FK para product_addons).
export async function deleteAddon(id: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("product_addons").delete().eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

// Grupos de opção (migration 012) — o grupo é o único conceito novo; as opções
// são os adicionais com group_id preenchido (design D4).
export async function saveAddonGroup(input: {
  id?: string; name: string; required: boolean; maxChoices: number | null; sortOrder: number;
}): Promise<R & { id?: string }> {
  const { supabase, storeId } = await requireStore();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 40) return { ok: false, error: "Nome do grupo: 1 a 40 letras." };
  if (input.maxChoices !== null && input.maxChoices < 1) {
    return { ok: false, error: "Máximo de escolhas precisa ser 1 ou mais (ou vazio)." };
  }
  const row = { store_id: storeId, name, required: input.required, max_choices: input.maxChoices, sort_order: input.sortOrder };
  return mutate("/painel/cardapio", async () => {
    const q = input.id
      ? supabase.from("product_addon_groups").update(row).eq("id", input.id).eq("store_id", storeId).select("id").single()
      : supabase.from("product_addon_groups").insert(row).select("id").single();
    const { data, error } = await q;
    return { error, id: data?.id as string | undefined };
  });
}

export async function deleteAddonGroup(id: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    // cascade na FK apaga as opções do grupo — a UI confirma antes de chamar
    const { error } = await supabase.from("product_addon_groups").delete().eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

export async function setAddonGroup(addonId: string, groupId: string | null): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("product_addons").update({ group_id: groupId })
      .eq("id", addonId).eq("store_id", storeId);
    return { error };
  });
}

export type FichaInput = {
  id: string | null; name: string; description: string; category_id: string;
  price_cents: number; sort_order: number; active: boolean; addonIds: string[];
};

// Ficha (DS §8.11): insert/update + espelha adicionais marcados como linhas
// próprias (product_id); Excluir = active=false (nunca deleta).
export async function saveFicha(input: FichaInput): Promise<R & { id?: string }> {
  try {
    const { supabase, storeId } = await requireStore();
    const name = input.name.trim();
    if (name.length < 2) return { ok: false, error: "Nome com pelo menos 2 letras." };
    if (!Number.isInteger(input.price_cents) || input.price_cents < 0) {
      return { ok: false, error: "Preço inválido — use formato 49,90." };
    }
    if (!input.category_id) return { ok: false, error: "Escolha a categoria." };
    const row = {
      store_id: storeId, name, description: input.description.trim() || null,
      category_id: input.category_id, price_cents: input.price_cents,
      sort_order: input.sort_order || 0, active: input.active,
    };
    let id = input.id;
    if (id) {
      const { error } = await supabase.from("products").update(row).eq("id", id).eq("store_id", storeId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("products").insert(row).select("id").single();
      if (error) throw error;
      id = data.id as string;
    }
    const { data: globals } = await supabase.from("product_addons").select("id,name,price_cents")
      .eq("store_id", storeId).is("product_id", null).in("id", input.addonIds);
    await supabase.from("product_addons").delete().eq("store_id", storeId).eq("product_id", id);
    const picked = (globals ?? []) as { name: string; price_cents: number }[];
    if (picked.length > 0) {
      const { error } = await supabase.from("product_addons").insert(
        picked.map((g) => ({ store_id: storeId, product_id: id, name: g.name, price_cents: g.price_cents })),
      );
      if (error) throw error;
    }
    revalidatePath("/painel/cardapio");
    return { ok: true, id: id! };
  } catch (e) {
    const m = err(e);
    if (m.includes("PRODUCTS_LIMIT")) return { ok: false, error: "Teto de 200 produtos ativos atingido." };
    return { ok: false, error: m };
  }
}

export async function setProductImageUrl(id: string, image_url: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("products").update({ image_url }).eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

export async function deleteFicha(id: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("products").update({ active: false }).eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

// Configurações (DS §8.12) — salvamento por aba; validação de faixas espelha o
// trigger trg_validate_open_hours (o banco é o backstop final).
export async function saveLoja(input: {
  name: string; whatsapp: string; description: string; pix_key: string; marquee_text: string;
}): Promise<R> {
  const { supabase, storeId } = await requireStore();
  const digits = input.whatsapp.replace(/\D/g, "");
  if (input.name.trim().length < 2) return { ok: false, error: "Nome com pelo menos 2 letras." };
  if (!/^[0-9]{10,15}$/.test(digits)) return { ok: false, error: "WhatsApp: só dígitos, 10 a 15." };
  return mutate("/painel/configuracoes", async () => {
    const { error } = await supabase.from("stores").update({
      name: input.name.trim(), whatsapp: digits,
      description: input.description.trim() || null, pix_key: input.pix_key.trim() || null,
      marquee_text: input.marquee_text.trim() || null,
    }).eq("id", storeId);
    return { error };
  });
}

export async function setLogoUrl(logo_url: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/configuracoes", async () => {
    const { error } = await supabase.from("stores").update({ logo_url }).eq("id", storeId);
    return { error };
  });
}

// C-07: capa da loja (upload em logos/{store_id}/cover.webp — mesma policy de
// storage da logo, sem migration de bucket).
export async function setCoverUrl(cover_url: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/configuracoes", async () => {
    const { error } = await supabase.from("stores").update({ cover_url }).eq("id", storeId);
    return { error };
  });
}

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export async function saveHorarios(open_hours: Record<string, [string, string][]>): Promise<R> {
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  for (const [k, ranges] of Object.entries(open_hours)) {
    if (!/^[0-6]$/.test(k)) return { ok: false, error: `Dia inválido: ${k}.` };
    if (ranges.length > 3) return { ok: false, error: `${days[Number(k)]}: máx 3 faixas/dia.` };
    for (const [from, to] of ranges) {
      if (!HHMM.test(from) || !HHMM.test(to)) return { ok: false, error: `${days[Number(k)]}: horário no formato HH:MM.` };
      if (to <= from) return { ok: false, error: `${days[Number(k)]}: fim (${to}) precisa ser maior que início (${from}).` };
    }
  }
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/configuracoes", async () => {
    const { error } = await supabase.from("stores").update({ open_hours }).eq("id", storeId);
    if (error) {
      if (error.message.includes("INVALID_OPEN_HOURS")) return { error: new Error("Horários rejeitados pelo banco — confira as faixas.") };
    }
    return { error };
  });
}

export type HoodInput = { id: string; name: string; fee_cents: number; active: boolean };

export async function saveEntrega(input: {
  hoods: HoodInput[]; deletedIds: string[];
  min_order_cents: number; prep_time_min: number; prep_time_max: number;
}): Promise<R> {
  try {
    if (!(input.prep_time_min > 0) || input.prep_time_max < input.prep_time_min) {
      return { ok: false, error: "Preparo: máx precisa ser ≥ mín." };
    }
    if (!Number.isInteger(input.min_order_cents) || input.min_order_cents < 0) {
      return { ok: false, error: "Pedido mínimo inválido." };
    }
    const { supabase, storeId } = await requireStore();
    if (input.deletedIds.length > 0) {
      const { error } = await supabase.from("neighborhoods").delete()
        .eq("store_id", storeId).in("id", input.deletedIds);
      if (error) throw error;
    }
    for (const h of input.hoods) {
      if (h.name.trim().length < 2 || !Number.isInteger(h.fee_cents) || h.fee_cents < 0) {
        return { ok: false, error: `Bairro "${h.name || "?"}": nome ≥2 letras e taxa ≥ 0.` };
      }
      if (h.id.startsWith("new-")) {
        const { error } = await supabase.from("neighborhoods")
          .insert({ store_id: storeId, name: h.name.trim(), fee_cents: h.fee_cents, active: h.active });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("neighborhoods")
          .update({ name: h.name.trim(), fee_cents: h.fee_cents, active: h.active })
          .eq("id", h.id).eq("store_id", storeId);
        if (error) throw error;
      }
    }
    const { error } = await supabase.from("stores").update({
      min_order_cents: input.min_order_cents,
      prep_time_min: input.prep_time_min, prep_time_max: input.prep_time_max,
    }).eq("id", storeId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Mesas do salão (dine_tables) — insert/update/delete com validação de número.
export async function saveTables(input: {
  tables: { id?: string; number: number; label: string; active: boolean }[];
  deletedIds: string[];
}): Promise<R> {
  try {
    for (const t of input.tables) {
      if (!Number.isInteger(t.number) || t.number < 1 || t.number > 999) {
        return { ok: false, error: "Número da mesa: 1 a 999." };
      }
    }
    const { supabase, storeId } = await requireStore();
    if (input.deletedIds.length > 0) {
      const { error } = await supabase.from("dine_tables").delete()
        .eq("store_id", storeId).in("id", input.deletedIds);
      if (error) throw error;
    }
    for (const t of input.tables) {
      const row = { store_id: storeId, number: t.number, label: t.label.trim(), active: t.active };
      if (!t.id || t.id.startsWith("new-")) {
        const { error } = await supabase.from("dine_tables").insert(row);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dine_tables").update(row)
          .eq("id", t.id).eq("store_id", storeId);
        if (error) throw error;
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteTable(id: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/configuracoes", async () => {
    const { error } = await supabase.from("dine_tables").delete().eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

// Meta de faturamento (design D2): upsert do ALVO em sales_goals; a janela é
// derivada na leitura (windowFor) — nunca gravada.
export async function saveMeta(period: GoalPeriod, targetCents: number): Promise<R> {
  const { supabase, storeId } = await requireStore();
  if (!(targetCents > 0)) return { ok: false, error: "A meta precisa ser maior que zero." };
  return mutate("/painel/relatorios", async () => {
    const { error } = await supabase.from("sales_goals")
      .upsert({ store_id: storeId, period, target_cents: targetCents }, { onConflict: "store_id,period" });
    return { error };
  });
}

// PDV (recon §3): cria pedido via RPC pdv_create_order (security definer).
export async function pdvCriarPedido(input: {
  type: 'dine_in' | 'pickup' | 'delivery';
  table_id?: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  items: { id: string; qty: number; addons: string[]; notes?: string }[];
}): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/pdv", async () => {
    const { data, error } = await supabase.rpc("pdv_create_order", {
      p_store_id: storeId,
      p_type: input.type,
      p_table_id: input.table_id ?? null,
      p_payment_method: input.payment_method,
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone,
      p_items: input.items,
    });
    if (error) {
      const msg = err(error);
      if (msg.includes("MESA_JA_OCUPADA")) return { error: new Error("Essa mesa já tem um pedido em aberto.") };
      if (msg.includes("MESA_INVALIDA")) return { error: new Error("Mesa inválida.") };
      return { error };
    }
    return { error: null, id: data?.order_id as string | undefined };
  });
}

// Entregas: assign de motoboy via RPC assign_courier (security definer).
export async function assignEntrega(orderId: string, courierId: string): Promise<R> {
  const { supabase } = await requireStore();
  return mutate("/painel/entregas", async () => {
    const { data, error } = await supabase.rpc("assign_courier", {
      p_order_id: orderId,
      p_courier_id: courierId,
    });
    if (error) {
      const msg = err(error);
      if (msg.includes("COURIER_EM_ROTA")) return { error: new Error("Esse motoboy já está em rota.") };
      if (msg.includes("ORDER_NOT_READY")) return { error: new Error("Pedido não está pronto para entrega.") };
      if (msg.includes("COURIER_INVALID")) return { error: new Error("Motoboy inválido.") };
      return { error };
    }
    return { error: null, id: data as string };
  });
}

// Financeiro (recon §5): caixa + contas a pagar. Todos via mutate().

export async function abrirCaixa(openingCents: number): Promise<R> {
  const { supabase, storeId } = await requireStore();
  if (!Number.isInteger(openingCents) || openingCents < 0) {
    return { ok: false, error: "Fundo inicial inválido." };
  }
  return mutate("/painel/financeiro", async () => {
    const { error } = await supabase.from("cash_sessions")
      .insert({ store_id: storeId, opening_cents: openingCents });
    return { error };
  });
}

export async function movimentoCaixa(direction: "in" | "out", amount: number, note: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Valor do movimento inválido." };
  }
  return mutate("/painel/financeiro", async () => {
    // caixa aberto da loja
    const { data: session, error: sErr } = await supabase.from("cash_sessions")
      .select("id").eq("store_id", storeId).is("closed_at", null).single();
    if (sErr || !session) return { error: new Error("Abra o caixa antes de lançar movimentos.") };
    const { error } = await supabase.from("cash_movements")
      .insert({ store_id: storeId, session_id: session.id, direction, amount_cents: amount, note: note.trim() || null });
    return { error };
  });
}

export async function fecharCaixa(closingCents: number): Promise<R> {
  const { supabase, storeId } = await requireStore();
  if (!Number.isInteger(closingCents) || closingCents < 0) {
    return { ok: false, error: "Valor contado inválido." };
  }
  return mutate("/painel/financeiro", async () => {
    const { data: session, error: sErr } = await supabase.from("cash_sessions")
      .select("id").eq("store_id", storeId).is("closed_at", null).single();
    if (sErr || !session) return { error: new Error("Caixa já está fechado ou não foi aberto.") };
    const { error } = await supabase.from("cash_sessions")
      .update({ closing_cents: closingCents, closed_at: new Date().toISOString() })
      .eq("id", session.id);
    return { error };
  });
}

export async function pagarConta(id: string, paidCents: number): Promise<R> {
  const { supabase, storeId } = await requireStore();
  if (!Number.isInteger(paidCents) || paidCents <= 0) {
    return { ok: false, error: "Valor pago inválido." };
  }
  return mutate("/painel/financeiro", async () => {
    const { data: conta, error: cErr } = await supabase.from("payable_accounts")
      .select("paid,amount_cents").eq("id", id).eq("store_id", storeId).single();
    if (cErr || !conta) return { error: new Error("Conta não encontrada.") };
    if (conta.paid) return { error: null }; // idempotente
    if (paidCents > conta.amount_cents) {
      return { error: new Error("Valor pago não pode passar do devido.") };
    }
    const { error } = await supabase.from("payable_accounts")
      .update({ paid: true, paid_at: new Date().toISOString(), paid_cents: paidCents })
      .eq("id", id);
    return { error };
  });
}

export async function saveConta(input: {
  id?: string; description: string; amountCents: number; dueDate: string;
}): Promise<R & { id?: string }> {
  const { supabase, storeId } = await requireStore();
  const description = input.description.trim();
  if (description.length < 2) return { ok: false, error: "Descrição com pelo menos 2 letras." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "Valor inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return { ok: false, error: "Vencimento inválido." };
  }
  const row = { store_id: storeId, description, amount_cents: input.amountCents, due_date: input.dueDate };
  return mutate("/painel/financeiro", async () => {
    const q = input.id
      ? supabase.from("payable_accounts").update(row).eq("id", input.id).eq("store_id", storeId).select("id").single()
      : supabase.from("payable_accounts").insert(row).select("id").single();
    const { data, error } = await q;
    return { error, id: data?.id as string | undefined };
  });
}

export async function deleteConta(id: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/financeiro", async () => {
    const { error } = await supabase.from("payable_accounts").delete().eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

// Rastreamento (recon §8): upsert de fb_pixel_id/ga4_id. Valida com
// sanitizeTrackingId — id inválido nunca vira <script> na vitrine.
export async function saveTracking(fb_pixel_id: string, ga4_id: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  const pixel = sanitizeTrackingId("pixel", fb_pixel_id);
  const ga4 = sanitizeTrackingId("ga4", ga4_id);
  if (!pixel && !ga4) return { ok: false, error: "Pixel/GA4 inválido." };
  return mutate("/painel/configuracoes", async () => {
    const { error } = await supabase.from("store_tracking")
      .upsert({ store_id: storeId, fb_pixel_id: pixel, ga4_id: ga4 });
    return { error };
  });
}

// Cadastro de motoboy com acesso ao PWA (Task 9).
export async function criarMotoboy(input: { name: string; phone: string; email: string; password: string }): Promise<R> {
  try {
    const { storeId } = await requireStore();
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) return { ok: false, error: "Nome com pelo menos 2 letras." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "E-mail inválido." };
    if (input.password.length < 8) return { ok: false, error: "Senha com pelo menos 8 caracteres." };

    const admin = createAdminClient();
    const { data: created, error: uerr } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
    });
    if (uerr) {
      if (uerr.message.includes("EMAIL_EXISTS") || uerr.message.includes("already been registered")) {
        return { ok: false, error: "E-mail já cadastrado." };
      }
      return { ok: false, error: uerr.message };
    }
    if (!created?.user) return { ok: false, error: "Erro ao criar usuário." };

    const { error } = await admin.from("couriers")
      .insert({ store_id: storeId, name, phone: input.phone.trim(), user_id: created.user.id });
    if (error) {
      await admin.auth.admin.deleteUser(created.user.id); // rollback: não deixar órfão
      return { ok: false, error: error.message };
    }
    revalidatePath("/painel/entregas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
