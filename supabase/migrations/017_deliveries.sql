-- 017_deliveries.sql — entregas com motoboy (sem mapa).
-- Tabelas: couriers, routes (status open/closed), route_stops.
-- RPC assign_courier: security definer, valida pedido 'out' (Trava A),
-- courier ativo da loja, courier não já em rota; cria route+route_stop.

create table if not exists couriers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null,
  phone text,
  active boolean not null default true
);

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  courier_id uuid not null references couriers on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes on delete cascade,
  order_id uuid not null references orders on delete cascade,
  seq integer not null default 1,
  delivered_at timestamptz,
  unique (route_id, order_id)
);

alter table couriers enable row level security;
alter table routes enable row level security;
alter table route_stops enable row level security;

drop policy if exists "lojista_all" on couriers;
create policy "lojista_all" on couriers
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

drop policy if exists "lojista_all" on routes;
create policy "lojista_all" on routes
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

-- route_stops: policy derivada via routes → store_id
drop policy if exists "lojista_all" on route_stops;
create policy "lojista_all" on route_stops
  for all to authenticated
  using (
    exists (
      select 1 from routes r
      where r.id = route_stops.route_id and r.store_id = auth_store_id()
    )
  )
  with check (
    exists (
      select 1 from routes r
      where r.id = route_stops.route_id and r.store_id = auth_store_id()
    )
  );

create index if not exists idx_couriers_store on couriers(store_id);
create index if not exists idx_routes_store on routes(store_id);
create index if not exists idx_routes_courier on routes(courier_id);
create index if not exists idx_route_stops_route on route_stops(route_id);
create index if not exists idx_route_stops_order on route_stops(order_id);

-- RPC assign_courier: security definer, valida e cria route+route_stop.
create or replace function assign_courier(p_order_id uuid, p_courier_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid;
  v_order_status text;
  v_courier_active boolean;
  v_route_id uuid;
begin
  -- valida pedido da loja e status='out' (Trava A)
  select store_id, status into v_store, v_order_status
  from orders where id = p_order_id;
  if v_store is null or v_store <> auth_store_id() then
    raise exception 'NOT_YOUR_STORE';
  end if;
  if v_order_status <> 'out' then
    raise exception 'ORDER_NOT_READY';
  end if;

  -- valida courier ativo da loja
  select active into v_courier_active
  from couriers where id = p_courier_id and store_id = auth_store_id();
  if v_courier_active is null or v_courier_active = false then
    raise exception 'COURIER_INVALID';
  end if;

  -- courier não já em rota aberta
  if exists (
    select 1 from routes
    where courier_id = p_courier_id and status = 'open'
  ) then
    raise exception 'COURIER_EM_ROTA';
  end if;

  -- cria route
  insert into routes (store_id, courier_id, status)
  values (auth_store_id(), p_courier_id, 'open')
  returning id into v_route_id;

  -- cria route_stop
  insert into route_stops (route_id, order_id, seq)
  values (v_route_id, p_order_id, 1);

  -- chama set_order_status (pedido já está 'out', mantém status)
  perform set_order_status(p_order_id, 'out', null, 'store');

  return v_route_id;
end;
$$;

grant execute on function assign_courier(uuid, uuid) to authenticated;
