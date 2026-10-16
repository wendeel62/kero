-- 025_product_destaque.sql — paridade com cardapio-digital Product.destaque.
-- Selo "MAIS PEDIDO" do pcard. Nulo/antigo = sem selo.
alter table products add column if not exists destaque boolean not null default false;
