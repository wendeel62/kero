-- 022_lojista_pos_delete.sql — LGPD: encerrar rota APAGA a posição do motoboy.
-- Sem esta policy o delete do encerrarRota era bloqueado pelo RLS em silêncio
-- (lojista só tinha SELECT): a posição ficava no banco para sempre.
drop policy if exists "lojista_pos_delete" on courier_positions;
create policy "lojista_pos_delete" on courier_positions
  for delete to authenticated using (store_id = auth_store_id());
