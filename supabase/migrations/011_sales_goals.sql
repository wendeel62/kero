-- 011_sales_goals.sql — meta de faturamento por loja e período.
-- Só o ALVO é gravado; a janela (dia/semana/mês) é derivada na leitura
-- (design D2) — dataInicio/dataFim envelheciam no cardapio-digital.
create table if not exists sales_goals (
  store_id uuid not null references stores on delete cascade,
  period text not null check (period in ('daily','weekly','monthly')),
  target_cents integer not null check (target_cents > 0),
  primary key (store_id, period)
);

alter table sales_goals enable row level security;

drop policy if exists "lojista_all" on sales_goals;
create policy "lojista_all" on sales_goals
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());
