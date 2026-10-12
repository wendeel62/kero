-- 021_motoboy_live.sql — motoboy vinculado a usuário + posição ao vivo.
alter table couriers add column if not exists user_id uuid unique references auth.users on delete set null;

create table if not exists courier_positions (
  courier_id uuid primary key references couriers on delete cascade,
  store_id uuid not null references stores on delete cascade,
  lat float8 not null,
  lng float8 not null,
  precisao float8,
  atualizado_em timestamptz not null default now()
);

create or replace function auth_courier_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from couriers where user_id = auth.uid()
$$;

-- store_id do próprio motoboy: usado no with check p/ impedir forjar outra loja
create or replace function auth_courier_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from couriers where user_id = auth.uid()
$$;

revoke execute on function auth_courier_id() from public, anon;
revoke execute on function auth_courier_store_id() from public, anon;
grant execute on function auth_courier_id() to authenticated;
grant execute on function auth_courier_store_id() to authenticated;

alter table courier_positions enable row level security;

-- motoboy: lê a própria linha de couriers
drop policy if exists "courier_self_select" on couriers;
create policy "courier_self_select" on couriers
  for select to authenticated using (user_id = auth.uid());

-- motoboy: lê as próprias rotas ABERTAS e paradas
drop policy if exists "courier_routes_select" on routes;
create policy "courier_routes_select" on routes
  for select to authenticated using (courier_id = auth_courier_id() and status = 'open');

drop policy if exists "courier_stops_select" on route_stops;
create policy "courier_stops_select" on route_stops
  for select to authenticated
  using (exists (select 1 from routes r where r.id = route_stops.route_id and r.courier_id = auth_courier_id() and r.status = 'open'));

-- motoboy: lê só os pedidos das rotas ABERTAS
drop policy if exists "courier_orders_select" on orders;
create policy "courier_orders_select" on orders
  for select to authenticated
  using (exists (
    select 1 from route_stops rs
    join routes r on r.id = rs.route_id
    where rs.order_id = orders.id and r.courier_id = auth_courier_id() and r.status = 'open'
  ));

-- motoboy: escreve/lê a própria posição; store_id derivado do courier (nunca do cliente)
drop policy if exists "courier_pos_self" on courier_positions;
create policy "courier_pos_self" on courier_positions
  for all to authenticated
  using (courier_id = auth_courier_id())
  with check (courier_id = auth_courier_id() and store_id = auth_courier_store_id());

-- lojista: lê as posições da própria loja
drop policy if exists "lojista_pos_select" on courier_positions;
create policy "lojista_pos_select" on courier_positions
  for select to authenticated using (store_id = auth_store_id());

create index if not exists idx_courier_positions_store on courier_positions(store_id);

alter publication supabase_realtime add table courier_positions;
