import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

type Profile = { role: "loja" | "admin"; store_id: string | null };

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", user.id)
    .single();
  return { supabase, userId: user.id, profile: (profile ?? null) as Profile | null };
}

// Guard do painel do lojista (SPEC §6 + emenda v3.1 #15: lojista órfão = não autenticado).
export async function requireStore() {
  const s = await session();
  if (s.profile?.role === "admin") redirect("/admin");
  if (!s.profile?.store_id) redirect("/login");
  return { supabase: s.supabase, userId: s.userId, storeId: s.profile.store_id };
}

// Guard do painel do operador (SPEC §6: profiles.role='admin').
export async function requireAdmin() {
  const s = await session();
  if (s.profile?.role !== "admin") redirect(s.profile?.store_id ? "/painel" : "/login");
  return { supabase: s.supabase, userId: s.userId };
}

// Guard p/ rotas de API: 401 JSON é responsabilidade do caller; aqui só null.
// Posse da loja fica no RPC (lojista órfão vira NOT_YOUR_STORE 403 — honesto).
export async function requireStoreApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

// Guard p/ rotas /api/admin/*: null = sem sessão OU sem role admin (caller → 401).
export async function requireAdminApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;
  return { supabase, userId: user.id };
}

// Guard do painel do motoboy (client-side; usa browser client p/ auth em rota pública).
export async function requireCourier() {
  const supabase = await createBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/motoboy/login");
  const { data: courier } = await supabase
    .from("couriers")
    .select("id, store_id")
    .eq("user_id", user.id)
    .single();
  if (!courier) redirect("/motoboy/login");
  return { supabase, userId: user.id, courierId: courier.id, storeId: courier.store_id };
}
