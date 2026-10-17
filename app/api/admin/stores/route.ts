import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { sanitizeLikeTerm } from "@/lib/admin-utils";
import { requireAdminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Rotas do operador (SPEC §2.28 + M6 ADMIN-02). Tudo via service role;
// sessão só p/ autorizar (requireAdminApi → 401 fail closed).
const PER_PAGE = 50;
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const PHONE_RE = /^[0-9]{10,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASS_ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const genPassword = () => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => PASS_ABC[b % PASS_ABC.length]).join("");
};

type StoreBody = {
  name?: unknown;
  slug?: unknown;
  owner_email?: unknown;
  whatsapp?: unknown;
  id?: unknown;
  active?: unknown;
  reset_password?: unknown;
  plan?: unknown;
  segment?: unknown;
};

const PLANS = ["basico", "completo"] as const;
type Plan = (typeof PLANS)[number];

const parsePlan = (v: unknown): Plan | undefined | null => {
  if (v === undefined) return undefined; // usa default do banco ('basico')
  if (typeof v === "string" && (PLANS as readonly string[]).includes(v)) return v as Plan;
  return null; // inválido
};

// parse estrito p/ PATCH [id]: distingue "ausente" (undefined) de "inválido" (erro)
const parsePlanStrict = (v: unknown): { ok: true; value: Plan } | { ok: false } | null => {
  if (v === undefined) return null;
  if (typeof v === "string" && (PLANS as readonly string[]).includes(v))
    return { ok: true, value: v as Plan };
  return { ok: false };
};

const parseSegmentStrict = (
  v: unknown,
): { ok: true; value: string | null } | { ok: false } | null => {
  if (v === undefined) return null;
  if (v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false };
  const t = v.trim();
  if (!t) return { ok: true, value: null };
  if (t.length > 40) return { ok: false };
  return { ok: true, value: t };
};

// GET ?page=N&status=all|active|inactive&q= (ilike em name/slug) — SPEC §11.
export async function GET(req: Request) {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  const q = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(q.get("page") ?? "1", 10) || 1);
  const status = q.get("status") ?? "all";
  const term = sanitizeLikeTerm(q.get("q") ?? "");
  const from = (page - 1) * PER_PAGE;

  let query = createAdminClient()
    .from("stores")
    .select("id,slug,name,active,whatsapp,created_at,plan,segment,adesao_paid_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (status === "active") query = query.eq("active", true);
  else if (status === "inactive") query = query.eq("active", false);
  if (term) query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);

  const { data, error, count } = await query;
  if (error) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  return NextResponse.json({ stores: data ?? [], page, per_page: PER_PAGE, total: count ?? 0 });
}

// POST { name, slug, owner_email, whatsapp? } → 201 { store, owner, password }.
// Nasce active:false (trigger 002 exige prep_time p/ ativar — fluxo M6 ativa depois).
export async function POST(req: Request) {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as StoreBody;
  const { name, slug, owner_email: ownerEmail, whatsapp } = b;

  if (typeof slug !== "string" || !SLUG_RE.test(slug))
    return apiError("INVALID_SLUG", "Slug inválido (a-z, 0-9, hífen, 3–40).", 400);
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80)
    return apiError("INVALID_NAME", "Nome inválido (2–80 caracteres).", 400);
  if (typeof ownerEmail !== "string" || !EMAIL_RE.test(ownerEmail))
    return apiError("INVALID_EMAIL", "E-mail inválido.", 400);
  if (whatsapp !== undefined && (typeof whatsapp !== "string" || !PHONE_RE.test(whatsapp)))
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  const plan = parsePlan(b.plan);
  if (plan === null) return apiError("INVALID_BODY", "Plano inválido (basico|completo).", 400);
  const segParsed = parseSegmentStrict(b.segment);
  if (segParsed && !segParsed.ok)
    return apiError("INVALID_BODY", "Segmento inválido (máx. 40 caracteres).", 400);
  const segment = segParsed && segParsed.ok ? segParsed.value : undefined;

  const db = createAdminClient();
  const { data: dup } = await db.from("stores").select("id").eq("slug", slug).maybeSingle();
  if (dup) return apiError("SLUG_TAKEN", "Esse slug já está em uso.", 409);

  const { data: store, error: storeError } = await db
    .from("stores")
    .insert({
      slug,
      name: (name as string).trim(),
      whatsapp: typeof whatsapp === "string" ? whatsapp : "0000000000",
      open_hours: {},
      active: false,
      ...(plan !== undefined ? { plan } : {}),
      ...(segment !== undefined ? { segment } : {}),
    })
    .select("id,slug,name,active,plan,segment")
    .single();
  if (storeError || !store) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);

  // LIÇÃO M2: usuário SÓ via Auth Admin API (insert em auth.users envenena o GoTrue).
  const password = genPassword();
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email: ownerEmail as string,
    password,
    email_confirm: true,
  });
  if (userError || !created.user) {
    await db.from("stores").delete().eq("id", store.id); // sem loja órfã
    const dup =
      userError &&
      (userError.status === 400 ||
        userError.status === 422 ||
        /already|duplicate|exists/i.test(userError.message ?? ""));
    if (dup) return apiError("EMAIL_TAKEN", "E-mail já cadastrado.", 409);
    return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  }

  // Trigger fn_on_signup cria o profile (role loja); aqui só o vínculo.
  await db.from("profiles").update({ store_id: store.id }).eq("id", created.user.id);
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("id", created.user.id)
    .maybeSingle();
  if (!profile) {
    const { error: upError } = await db
      .from("profiles")
      .upsert({ id: created.user.id, store_id: store.id, role: "loja" });
    if (upError) {
      await db.from("stores").delete().eq("id", store.id);
      await db.auth.admin.deleteUser(created.user.id);
      return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
    }
  }

  return NextResponse.json(
    { store, owner: { email: ownerEmail }, password },
    { status: 201 },
  );
}

// PATCH { id, active? } | { id, reset_password?: true } (lista fechada §4.1).
export async function PATCH(req: Request) {
  const a = await requireAdminApi();
  if (!a) return apiError("UNAUTHORIZED", "Faça login para continuar.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as StoreBody;
  if (typeof b.id !== "string" || !b.id)
    return apiError("INVALID_BODY", "Dados inválidos.", 400);
  const hasActive = typeof b.active === "boolean";
  const hasReset = b.reset_password === true;
  if ((hasActive && hasReset) || (!hasActive && !hasReset))
    return apiError("INVALID_BODY", "Dados inválidos.", 400);

  const db = createAdminClient();
  const { data: store } = await db.from("stores").select("id").eq("id", b.id).maybeSingle();
  if (!store) return apiError("STORE_NOT_FOUND", "Loja não encontrada.", 404);

  if (hasActive) {
    const { data: updated, error } = await db
      .from("stores")
      .update({ active: b.active })
      .eq("id", b.id)
      .select("id,active")
      .single();
    if (error) {
      if (error.message.includes("STORE_NOT_CONFIGURED"))
        return apiError(
          "STORE_NOT_CONFIGURED",
          "A loja está mal configurada. Tente mais tarde ou fale com o suporte.",
          409,
        );
      return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
    }
    return NextResponse.json({ ok: true, store: updated });
  }

  const { data: owner } = await db
    .from("profiles")
    .select("id")
    .eq("store_id", b.id)
    .eq("role", "loja")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!owner) return apiError("OWNER_NOT_FOUND", "Loja sem dono vinculado.", 404);
  const password = genPassword();
  const { error: pwError } = await db.auth.admin.updateUserById(owner.id, { password });
  if (pwError) return apiError("UNEXPECTED", "Erro inesperado. Tente de novo.", 500);
  return NextResponse.json({ ok: true, password });
}
