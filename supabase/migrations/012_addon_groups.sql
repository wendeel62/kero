-- 012_addon_groups.sql — grupos de opcao (design D4).
-- Grupo e o unico conceito; as OPCOES sao as linhas de product_addons com
-- group_id preenchido. group_id null = grupo "Adicionais" implicito, derivado
-- na leitura — nao ha backfill nem segunda forma de armazenar.
create table if not exists product_addon_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  required boolean not null default false,
  max_choices integer check (max_choices is null or max_choices >= 1),
  sort_order integer not null default 0,
  unique (id, store_id)
);

-- idempotente: enable RLS não tem `if not exists`, então checa o catálogo antes
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.product_addon_groups'::regclass) then
    alter table product_addon_groups enable row level security;
  end if;
end $$;

drop policy if exists "lojista_all" on product_addon_groups;
create policy "lojista_all" on product_addon_groups
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

alter table product_addons add column if not exists group_id uuid;

alter table product_addons drop constraint if exists product_addons_group_fk;
alter table product_addons
  add constraint product_addons_group_fk
  foreign key (group_id, store_id) references product_addon_groups (id, store_id)
  on delete cascade;

create index if not exists idx_addon_groups_store on product_addon_groups(store_id);
create index if not exists idx_addons_group        on product_addons(group_id);
