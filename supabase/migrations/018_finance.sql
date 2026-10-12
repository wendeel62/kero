-- 018_finance.sql — caixa + contas a pagar (financeiro do painel lojista).
-- Tabelas: cash_sessions, cash_movements (FK session, on delete cascade),
-- payable_accounts. Todas RLS lojista_all por store_id.
-- Regra de um caixa aberto por loja: índice parcial único.

create table if not exists cash_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cents integer not null check (opening_cents >= 0),
  closing_cents integer
);

create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  session_id uuid not null references cash_sessions on delete cascade,
  direction text not null check (direction in ('in','out')),
  amount_cents integer not null check (amount_cents > 0),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists payable_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  paid boolean not null default false,
  paid_at timestamptz,
  paid_cents integer
);

alter table cash_sessions enable row level security;
alter table cash_movements enable row level security;
alter table payable_accounts enable row level security;

drop policy if exists "lojista_all" on cash_sessions;
create policy "lojista_all" on cash_sessions
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

drop policy if exists "lojista_all" on cash_movements;
create policy "lojista_all" on cash_movements
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

drop policy if exists "lojista_all" on payable_accounts;
create policy "lojista_all" on payable_accounts
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

-- Um caixa aberto por loja (índice parcial único)
create unique index if not exists idx_cash_sessions_one_open_per_store
  on cash_sessions (store_id) where closed_at is null;

create index if not exists idx_cash_movements_session on cash_movements(session_id);
create index if not exists idx_payable_accounts_store on payable_accounts(store_id);
