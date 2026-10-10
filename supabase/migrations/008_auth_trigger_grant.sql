-- 008_auth_trigger_grant.sql — corrige efeito colateral do 006:
-- trg_on_signup dispara como supabase_auth_admin (INSERT em auth.users via Auth API).
-- O 006 revogou EXECUTE de PUBLIC; o GoTrue não é owner/superuser → criação de
-- usuário 500 ("Database error"). Garante EXECUTE ao papel que dispara o trigger.
grant execute on function fn_on_signup() to supabase_auth_admin;
