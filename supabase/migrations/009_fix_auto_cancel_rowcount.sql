-- 009_fix_auto_cancel_rowcount.sql — `return sql%rowcount` é sintaxe inválida
-- em plpgsql (vira `sql % rowcount` → "column sql does not exist"); o cron
-- daily-salt (API-05) quebrava com 500 em toda chamada. GET DIAGNOSTICS é o
-- mecanismo correto p/ ROW_COUNT após UPDATE.
create or replace function auto_cancel_stale_orders() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_n integer;
begin
  perform set_config('app.actor', 'system', true);
  update orders set status = 'cancelled',
                    cancellation_reason = 'timeout_24h',
                    canceled_by = 'system'
  where status = 'new'
    and created_at < now() - interval '24 hours';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
