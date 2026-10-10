-- =====================================================================
-- 004_realtime_storage.sql — publication + bucket (SPEC v3 §4)
-- Task: DB-05 (backlog)
-- Sem isso: kanban não recebe eventos (SPEC §4) e o CI falha
-- (SPEC §9: "CI falha se pg_publication_tables não contiver orders").
-- =====================================================================

-- =========== Realtime: orders na publicação ===========
alter publication supabase_realtime add table orders;

-- =========== Storage: bucket store-assets ===========
-- Layout (SPEC §4): store_id SEMPRE no segmento 2 do caminho.
-- Resolução da ambiguidade SPEC §4 ("loja/{store_id}/logo.webp") vs
-- SPEC §11 ("logos/{store_id}.webp") — ver checkpoint M1:
--   logos/{store_id}/logo.webp
--   products/{store_id}/{product_id}.webp
insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

-- leitura pública (logos/fotos aparecem na vitrine anon)
create policy "store_assets_public_read" on storage.objects
  for select to public
  using (bucket_id = 'store-assets');

-- upload/substituição: lojista só na pasta da PRÓPRIA loja
create policy "store_assets_lojista_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] in ('logos', 'products')
    and (storage.foldername(name))[2] = auth_store_id()::text
  );

create policy "store_assets_lojista_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] in ('logos', 'products')
    and (storage.foldername(name))[2] = auth_store_id()::text
  )
  with check (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] in ('logos', 'products')
    and (storage.foldername(name))[2] = auth_store_id()::text
  );
