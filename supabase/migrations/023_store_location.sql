-- 023_store_location.sql — ponto fixo da loja (origem das entregas).
-- Nullable: loja sem localização continua vendendo normalmente; só não calcula
-- distância nem aparece como ponto de origem nos mapas. Os checks espelham
-- posicaoValida (lib/geocode.ts) — o banco é o backstop final.
alter table stores add column if not exists lat float8;
alter table stores add column if not exists lng float8;

alter table stores drop constraint if exists stores_lat_range;
alter table stores add constraint stores_lat_range check (lat is null or (lat between -90 and 90));

alter table stores drop constraint if exists stores_lng_range;
alter table stores add constraint stores_lng_range check (lng is null or (lng between -180 and 180));
