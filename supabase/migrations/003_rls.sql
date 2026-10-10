-- =====================================================================
-- 003_rls.sql — RLS policies + grants (SPEC v3 §6)
-- Task: DB-04 (backlog)
-- Matriz da SPEC §6:
--   stores, categories, products, product_addons, neighborhoods:
--     anon SELECT (active=true) · lojista ALL próprio store_id · admin service role
--   profiles: nada p/ anon · lojista SELECT própria linha
--   orders, order_items, order_events: NADA p/ anon (público só via
--     /api/orders/track/[token] com service_role) · lojista SELECT próprio
--     store_id (orders: UPDATE só nas colunas permitidas via grant)
-- =====================================================================

-- =========== enable RLS em tudo ===========
alter table stores          enable row level security;
alter table profiles        enable row level security;
alter table daily_salt      enable row level security;
alter table categories      enable row level security;
alter table products        enable row level security;
alter table product_addons  enable row level security;
alter table neighborhoods   enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table order_events    enable row level security;

-- =========== catálogo público (vitrine) ===========
-- anon vê só o que está ativo de loja ativa (loja inativa = 404 público, SPEC §2.17)
create policy "anon_select" on stores
  for select to anon using (active);

create policy "anon_select" on categories
  for select to anon using (active and exists (
    select 1 from stores s where s.id = store_id and s.active));

create policy "anon_select" on products
  for select to anon using (active and exists (
    select 1 from stores s where s.id = store_id and s.active));

create policy "anon_select" on product_addons
  for select to anon using (active and exists (
    select 1 from stores s where s.id = store_id and s.active));

create policy "anon_select" on neighborhoods
  for select to anon using (active and exists (
    select 1 from stores s where s.id = store_id and s.active));

-- =========== lojista: própria loja (auth_store_id) ===========
create policy "lojista_all" on stores
  for all to authenticated
  using (id = auth_store_id()) with check (id = auth_store_id());

create policy "lojista_all" on categories
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

create policy "lojista_all" on products
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

create policy "lojista_all" on product_addons
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

create policy "lojista_all" on neighborhoods
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

-- =========== profiles: cada um lê a própria linha ===========
create policy "self_select" on profiles
  for select to authenticated using (id = auth.uid());

-- daily_salt: SEM policies → negado a anon/authenticated (service role bypassa)

-- =========== orders: lojista vê e transiciona o que é seu ===========
-- (anon: NENHUMA policy — pedido público só existe via /api/orders/track/[token])
create policy "lojista_select" on orders
  for select to authenticated using (store_id = auth_store_id());

create policy "lojista_update" on orders
  for update to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

create policy "lojista_select" on order_items
  for select to authenticated
  using (exists (select 1 from orders o
                  where o.id = order_items.order_id
                    and o.store_id = auth_store_id()));

create policy "lojista_select" on order_events
  for select to authenticated
  using (exists (select 1 from orders o
                  where o.id = order_events.order_id
                    and o.store_id = auth_store_id()));

-- =========== column grants (SPEC §6 — RLS não filtra coluna) ===========
-- rede de segurança junto à RPC set_order_status: lojista só mexe nisso
revoke update on orders from authenticated;
grant update (status, cancellation_reason, canceled_by, updated_at) on orders to authenticated;

-- =========== EXECUTE nas funções (default = PUBLIC: fechar) ===========
revoke execute on function set_order_status(uuid, text, text, text) from public, anon;
grant  execute on function set_order_status(uuid, text, text, text) to authenticated, service_role;

revoke execute on function create_order(uuid, text, text, integer, text, jsonb, jsonb, integer, text, text, text) from public, anon, authenticated;
grant  execute on function create_order(uuid, text, text, integer, text, jsonb, jsonb, integer, text, text, text) to service_role;

revoke execute on function auto_cancel_stale_orders() from public, anon, authenticated;
grant  execute on function auto_cancel_stale_orders() to service_role;

revoke execute on function get_daily_salt() from public, anon, authenticated;
grant  execute on function get_daily_salt() to service_role;
revoke execute on function calculate_ip_hash(text) from public, anon, authenticated;
revoke execute on function auth_store_id() from anon;
