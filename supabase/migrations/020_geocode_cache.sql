-- 020_geocode_cache.sql — cache de geocodificação + log de rate limit.
-- Só service_role acessa (RLS on, sem policy). lat/lng null quando falha=true.
create table if not exists geocode_cache (
  id uuid primary key default gen_random_uuid(),
  query_key text not null unique,
  lat float8,
  lng float8,
  endereco text,
  falha boolean not null default false,
  expira_em timestamptz,          -- TTL curto p/ cachear falhas
  criado_em timestamptz not null default now()
);
alter table geocode_cache enable row level security;

create table if not exists geocode_log (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  criado_em timestamptz not null default now()
);
alter table geocode_log enable row level security;
create index if not exists idx_geocode_log_ip on geocode_log(ip_hash, criado_em desc);
