-- 014_addon_groups_anon_read.sql — leitura pública dos grupos de opção.
-- A 012 criou product_addon_groups com apenas a policy do lojista
-- (authenticated), então a vitrine — que lê como anon — não via grupo nenhum:
-- o grupo obrigatório nunca aparecia para o cliente, enquanto a trava do
-- servidor (013) rejeitava o pedido. Leitura pública, como product_addons já
-- tem em 003 (anon_select: active = true).
drop policy if exists "anon_select" on product_addon_groups;
create policy "anon_select" on product_addon_groups
  for select to anon using (true);
