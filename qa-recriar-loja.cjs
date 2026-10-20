// Recria a loja QA para validacao dos bugs corrigidos. Limpa no final.
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SLUG = "loja-qa-hermes";
const OPEN = Object.fromEntries([...Array(7)].map((_, d) => [String(d), [["00:00", "23:59"]]]));

(async () => {
  // remove se existir
  const { data: existente } = await db.from("stores").select("id").eq("slug", SLUG);
  if (existente?.length) await db.from("stores").delete().eq("slug", SLUG);

  const { data: store } = await db.from("stores").insert({
    slug: SLUG, name: "Pizzaria QA Hermes", whatsapp: "11988887777", min_order_cents: 2000,
    prep_time_min: 30, prep_time_max: 60, open_hours: OPEN, active: true,
    lat: -3.1190, lng: -60.0217, pix_key: "qa@teste.local",
  }).select("id").single();
  const S = store.id;

  const { data: cat } = await db.from("categories").insert({ store_id: S, name: "Pizzas", sort_order: 0, active: true }).select("id").single();
  const { data: prod } = await db.from("products").insert({
    store_id: S, category_id: cat.id, name: "Margherita G", description: "Molho de tomate, muçarela.", price_cents: 4990,
    image_url: "https://ohcfnbaqorxcjmepsgct.supabase.co/storage/v1/object/public/store-assets/products/5751a74b-5feb-41be-be14-6c3967ca1383/aeefe17a-8285-4e53-bca1-bdd225f3adef.webp", active: true, destaque: true, sort_order: 0,
  }).select("id").single();

  const { data: group } = await db.from("product_addon_groups").insert({
    store_id: S, name: "Tamanho da massa", required: true, max_choices: 1, sort_order: 0,
  }).select("id").single();

  await db.from("product_addons").insert([
    { store_id: S, product_id: prod.id, name: "Pequena", price_cents: 0, active: true, group_id: group.id, is_removal: false, is_separate: false },
    { id: undefined, store_id: S, product_id: prod.id, name: "Grande", price_cents: 1000, active: true, group_id: group.id, is_removal: false, is_separate: false },
  ]);

  await db.from("neighborhoods").insert([
    { store_id: S, name: "Centro", fee_cents: 500, active: true },
    { store_id: S, name: "Jardins", fee_cents: 750, active: true },
  ]);

  // cria usuario lojista
  const { data: auth } = await db.auth.admin.createUser({
    email: "lojista.qa@teste.local", password: "QAloja2026!", email_confirm: true,
  });
  await db.from("profiles").upsert({ id: auth.user.id, store_id: S, role: "loja" });

  console.log("LOJA QA pronta:", S, "slug:", SLUG, "produto:", prod.id, "grupo:", group.id);
  console.log("credenciais: lojista.qa@teste.local / QAloja2026!");
})();
