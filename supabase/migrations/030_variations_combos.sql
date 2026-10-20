-- 030_variations_combos.sql — variações, combos e campos de personalização.
-- Colunas conforme spec 2026-10-18-customizacao-delivery-design.md §Modelo de Dados;
-- estrutura (FK composta, unique (id, store_id), RLS lojista_all) conforme 001/012.
-- As alterações em product_addon_groups/product_addons da spec já são da 031.

-- =========== product_variations ===========
create table if not exists product_variations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  product_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 40),   -- "P", "M", "G", "500ml"
  price_cents integer not null check (price_cents >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (id, store_id),
  unique (product_id, store_id, name),
  foreign key (product_id, store_id) references products (id, store_id)
);

-- =========== combos ===========
create table if not exists combos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  description text,
  price_cents integer not null check (price_cents >= 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique (id, store_id)
);

-- =========== combo_items ===========
create table if not exists combo_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  combo_id uuid not null,
  product_id uuid not null,
  qty integer not null default 1 check (qty >= 1),
  optional boolean not null default false,   -- true = cliente pode remover
  sort_order integer not null default 0,
  unique (id, store_id),
  unique (combo_id, store_id, product_id),
  foreign key (combo_id, store_id) references combos (id, store_id) on delete cascade,
  foreign key (product_id, store_id) references products (id, store_id)
);

-- =========== product_custom_fields ===========
create table if not exists product_custom_fields (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  product_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 60),   -- "Nome no bolo", "Mensagem"
  required boolean not null default false,
  max_length integer not null default 200 check (max_length between 1 and 1000),
  sort_order integer not null default 0,
  unique (id, store_id),
  foreign key (product_id, store_id) references products (id, store_id)
);

-- =========== RLS (idempotente — enable não tem IF NOT EXISTS) ===========
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.product_variations'::regclass) then
    alter table product_variations enable row level security;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.combos'::regclass) then
    alter table combos enable row level security;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.combo_items'::regclass) then
    alter table combo_items enable row level security;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.product_custom_fields'::regclass) then
    alter table product_custom_fields enable row level security;
  end if;
end $$;

drop policy if exists "lojista_all" on product_variations;
create policy "lojista_all" on product_variations
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

drop policy if exists "lojista_all" on combos;
create policy "lojista_all" on combos
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

drop policy if exists "lojista_all" on combo_items;
create policy "lojista_all" on combo_items
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

drop policy if exists "lojista_all" on product_custom_fields;
create policy "lojista_all" on product_custom_fields
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

-- =========== índices ===========
create index if not exists idx_variations_store      on product_variations(store_id);
create index if not exists idx_variations_product    on product_variations(product_id, store_id);
create index if not exists idx_combos_store          on combos(store_id);
create index if not exists idx_combo_items_store     on combo_items(store_id);
create index if not exists idx_combo_items_combo     on combo_items(combo_id, store_id);
create index if not exists idx_custom_fields_store   on product_custom_fields(store_id);
create index if not exists idx_custom_fields_product on product_custom_fields(product_id, store_id);
