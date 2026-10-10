-- 007_advisor_fixes.sql — 2 avisos do linter de performance
create index if not exists idx_profiles_store on profiles(store_id);

drop policy "self_select" on profiles;
create policy "self_select" on profiles
  for select to authenticated using (id = (select auth.uid()));
