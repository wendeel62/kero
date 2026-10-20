-- 028_geocode_origem.sql — marca se o ponto veio de rua (LocationIQ) ou só do centroide do CEP.
-- Em Manaus o centroide do prefixo 69082-xxx erra ~5km (bairro errado), então a UI
-- precisa saber que o ponto é aproximado e pedir confirmação do pino.
alter table geocode_cache add column if not exists origem text check (origem in ('endereco','cep'));

-- purga entradas antigas (pré-fix): vinham do fallback do CEP e não tinham como
-- ser distinguidas de um ponto de rua. Serão recalculadas com a rua real.
delete from geocode_cache where origem is null and endereco is null;