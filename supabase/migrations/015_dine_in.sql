-- 015_dine_in.sql — mesas do salão + tipo de pedido 'dine_in' (recon §3, Trava B).
-- Mesa é só a entidade; o pedido em mesa continua sendo um orders com type='dine_in'.
create table if not exists dine_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  number integer not null check (number between 1 and 999),
  label text,
  active boolean not null default true,
  unique (store_id, number)
);

alter table dine_tables enable row level security;

drop policy if exists "lojista_all" on dine_tables;
create policy "lojista_all" on dine_tables
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

-- Trava B: orders.type ganha 'dine_in' (001_schema.sql:97 só tinha delivery|pickup)
alter table orders drop constraint if exists orders_type_check;
alter table orders add constraint orders_type_check
  check (type in ('delivery','pickup','dine_in'));

-- pedido em mesa: FK separada (001:97 não tem). on delete set null libera a mesa.
alter table orders add column if not exists table_id uuid;
alter table orders drop constraint if exists orders_table_id_fkey;
alter table orders add constraint orders_table_id_fkey
  foreign key (table_id) references dine_tables (id) on delete set null;

create index if not exists idx_dine_tables_store on dine_tables(store_id);
