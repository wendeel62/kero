import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

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
