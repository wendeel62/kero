-- 026_saas_metrics.sql — comissão da plataforma (SaaS) em pedidos e lojas.
-- Task 1 (backlog): Migration & Schema para SaaS metrics.
-- Tabelas afetadas: orders (001_schema.sql:90), stores (001_schema.sql:10).
-- =====================================================================

-- Comissão que o SaaS fica em cada pedido (centavos, >= 0).
-- Preenchida no checkout com base na commission_pct da loja do pedido.
alter table orders add column if not exists platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0);

-- Percentual padrão de comissão da plataforma para a loja (ex: 10 = 10%).
-- Usado como referência ao calcular platform_fee_cents de novos pedidos.
alter table stores add column if not exists commission_pct integer not null default 10 check (commission_pct >= 0 and commission_pct <= 100);
