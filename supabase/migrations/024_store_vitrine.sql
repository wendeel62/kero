-- 024_store_vitrine.sql — paridade com o preview cardapio-digital:
-- tagline e avaliação da loja aparecem na vitrine pública. Nulas = ocultas.
-- (O spec v1 pedia "sem mudança de schema"; o dono aprovou a mudança em 2026-10-15.)
-- RLS anon_select é table-level: as colunas novas já são lidas sem policy nova.
alter table stores add column if not exists tagline text;
alter table stores add column if not exists rating numeric(3,1);
alter table stores add column if not exists rating_count integer;
