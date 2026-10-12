-- 019_store_tracking.sql — rastreamento (Pixel/GA4) por loja.
-- Tabela: store_tracking (1:1 com stores). RLS: anon_select só loja ativa,
-- lojista_all para escrita. Ids validados em lib/tracking.ts antes de injetar.

create table if not exists store_tracking (
  store_id uuid primary key references stores on delete cascade,
  fb_pixel_id text,
  ga4_id text
);

alter table store_tracking enable row level security;

-- anon: só vê tracking de loja ativa (pixel roda como anon na vitrine)
drop policy if exists "anon_select" on store_tracking;
create policy "anon_select" on store_tracking
  for select to anon using (exists (
    select 1 from stores s where s.id = store_id and s.active));

-- lojista: escrita na própria loja
drop policy if exists "lojista_all" on store_tracking;
create policy "lojista_all" on store_tracking
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());
