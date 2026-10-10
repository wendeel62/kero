-- =====================================================================
-- 001_schema.sql — tabelas + índices (SPEC v3 §5)
-- Fonte: docs/superpowers/specs/2026-10-04-saas-delivery-design-v3.md
-- Task: DB-02 (backlog) · SQL literal da spec — não "melhorar" além dela
-- =====================================================================

create extension if not exists pgcrypto;

-- =========== stores ===========
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),   -- IMUTÁVEL (trg_protect_store_columns)
  name text not null,
  logo_url text,
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  description text,
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  prep_time_min integer,
  prep_time_max integer,
  open_hours jsonb not null,   -- "0".."6" (0=domingo) → ≤3 faixas [["11:00","23:00"]]; final > inicial (trg_validate_open_hours)
  active boolean not null default false,      -- só via service_role (trg_protect_store_columns)
  force_closed boolean not null default false,
  force_closed_at timestamptz,
  pix_key text,
  created_at timestamptz not null default now()
);

-- =========== profiles (Auth users ↔ lojas) ===========
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  store_id uuid references stores on delete set null,   -- null = admin
  role text not null check (role in ('loja','admin')) default 'loja',
  created_at timestamptz not null default now()
);

-- =========== daily_salt (ip_hash — rotação 00:00 America/Manaus) ===========
create table if not exists daily_salt (
  day date primary key,   -- dia em America/Manaus
  salt text not null
);

-- =========== categories ===========
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (id, store_id)
);

-- =========== products ===========
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  category_id uuid not null,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique (id, store_id),
  foreign key (category_id, store_id) references categories (id, store_id)
);

-- =========== product_addons ===========
create table if not exists product_addons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  product_id uuid,                      -- null = global
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  unique (id, store_id),
  foreign key (product_id, store_id) references products (id, store_id)
);

-- =========== neighborhoods ===========
create table if not exists neighborhoods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null,
  fee_cents integer not null default 0 check (fee_cents >= 0),
  active boolean not null default true,
  unique (store_id, name)
);

-- =========== orders ===========
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  code text not null check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$'),
  tracking_token uuid not null unique default gen_random_uuid(),
  customer_name text not null check (length(customer_name) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,15}$'),
  type text not null check (type in ('delivery','pickup')),
  address jsonb,   -- entrega: {street,number,complement,reference,cep,neighborhood_id,neighborhood_name}; retirada: null; CEP 8 dígitos
  payment_method text not null check (payment_method in ('cash','pix','card_machine')),
  change_for_cents integer,
  pix_key text,
  notes text check (notes is null or length(notes) <= 300),
  subtotal_cents integer not null,
  delivery_fee_cents integer not null default 0,
  total_cents integer not null,
  promised_at timestamptz not null,
  status text not null default 'new'
    check (status in ('new','confirmed','preparing','ready','out','delivered','cancelled')),
  cancellation_reason text,
  canceled_by text check (canceled_by in ('store','customer','system')),
  anonymized_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- único por loja por dia (America/Manaus) — SPEC §2.26.
-- ponytail: UNIQUE de tabela não aceita expressão → índice único equivalente (mesma semântica).
create unique index if not exists uq_orders_store_code_day
  on orders (store_id, code, ((created_at at time zone 'America/Manaus')::date));

-- =========== order_items ===========
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  name_snapshot text not null,
  unit_price_cents integer not null,
  qty integer not null check (qty between 1 and 20),
  addons jsonb not null default '[]'::jsonb,   -- [{name:string, price_cents:int}]
  notes text check (notes is null or length(notes) <= 200)
);

-- =========== order_events ===========
create table if not exists order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  from_status text,
  to_status text not null,
  actor text not null default 'store' check (actor in ('store','customer','system')),
  created_at timestamptz not null default now()
);

-- =========== índices (SPEC §5) ===========
create index if not exists idx_categories_store          on categories(store_id);
create index if not exists idx_products_store            on products(store_id);
create index if not exists idx_products_category_store   on products(category_id, store_id);
create index if not exists idx_addons_store              on product_addons(store_id);
create index if not exists idx_addons_product_store      on product_addons(product_id, store_id);
create index if not exists idx_neighborhoods_store       on neighborhoods(store_id);
create index if not exists idx_orders_store_status_created on orders(store_id, status, created_at desc);
create index if not exists idx_orders_store_created      on orders(store_id, created_at desc);
create index if not exists idx_orders_store_phone_created on orders(store_id, customer_phone, created_at desc);
create index if not exists idx_orders_store_ip_created   on orders(store_id, ip_hash, created_at desc);
create index if not exists idx_order_items_order        on order_items(order_id);
create index if not exists idx_order_events_order       on order_events(order_id, created_at);
