-- =====================================================================
-- 006_hardening.sql — fix get_daily_salt + fechar EXECUTE público (advisors)
--
-- 1) get_daily_salt: gen_random_bytes/digest vivem no schema `extensions`
--    (Supabase); search_path precisa incluí-lo (mesmo fix do calculate_ip_hash).
-- 2) Funções em `public` nascem com EXECUTE p/ PUBLIC → viram RPC pública.
--    Helpers internos (triggers + funções chamadas por security definers)
--    não devem ser chamáveis por anon/authenticated.
-- 3) `set search_path` nas funções que faltavam (lint 0011).
-- =====================================================================

-- =========== fix get_daily_salt (search_path com extensions) ===========
create or replace function get_daily_salt() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_day date := (now() at time zone 'America/Manaus')::date;
  v_salt text;
begin
  select salt into v_salt from daily_salt where day = v_day;
  if v_salt is null then
    insert into daily_salt(day, salt) values (v_day, encode(gen_random_bytes(32), 'hex'))
      on conflict (day) do nothing;
    select salt into v_salt from daily_salt where day = v_day;
  end if;
  return v_salt;
end $$;

-- =========== search_path fixo nas funções sem (lint 0011) ===========
alter function fn_random_code()                    set search_path = public;
alter function promise_time(integer, integer)      set search_path = public;
alter function fn_store_is_open(jsonb)             set search_path = public;
alter function fn_validate_open_hours()            set search_path = public;
alter function fn_protect_store_columns()          set search_path = public;
alter function fn_enforce_order_status_transition() set search_path = public;
alter function fn_touch_updated_at()               set search_path = public;
alter function fn_check_order_items_limit()        set search_path = public;
alter function fn_check_products_limit()           set search_path = public;

-- =========== fechar EXECUTE p/ público nos helpers internos ===========
-- (triggers e security definers não precisam de EXECUTE p/ o caller)
revoke execute on function fn_random_code()                     from public, anon, authenticated;
revoke execute on function promise_time(integer, integer)       from public, anon, authenticated;
revoke execute on function fn_store_is_open(jsonb)              from public, anon, authenticated;
revoke execute on function fn_validate_open_hours()             from public, anon, authenticated;
revoke execute on function fn_protect_store_columns()           from public, anon, authenticated;
revoke execute on function fn_enforce_order_status_transition() from public, anon, authenticated;
revoke execute on function fn_touch_updated_at()                from public, anon, authenticated;
revoke execute on function fn_check_order_items_limit()         from public, anon, authenticated;
revoke execute on function fn_check_products_limit()            from public, anon, authenticated;
revoke execute on function fn_on_signup()                       from public, anon, authenticated;
revoke execute on function fn_record_order_event()              from public, anon, authenticated;

-- auth_store_id: policies do lojista e storage precisam dele → authenticated mantém,
-- anônimo e PUBLIC não (a 003 só revogou de anon; herança de PUBLIC reabria).
revoke execute on function auth_store_id() from public;
grant  execute on function auth_store_id() to authenticated;
