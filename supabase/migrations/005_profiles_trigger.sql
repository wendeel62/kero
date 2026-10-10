-- 005_profiles_trigger.sql — cria profile no signup (AUTH-04)
-- signup público fica OFF em config.toml; v1 lojista nasce via Auth Admin API (SPEC §2.28)
create or replace function fn_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role) values (new.id, 'loja')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_on_signup after insert on auth.users
  for each row execute function fn_on_signup();
