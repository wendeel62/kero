-- 034_geocode_cache_aproximado.sql — coluna de aproximacao no cache de geocode.
-- O campo `aproximado` indica se o ponto veio so do CEP (centroide) ou esta
-- a mais de 1km do centroide (sem número). A vitrine usa isso para mostrar o
-- aviso "Achamos so a regiao do CEP. Arraste o pino ate a sua porta."
alter table geocode_cache add column if not exists aproximado boolean not null default false;
