-- 029_ai_create_order.sql — RPC de pedido para a IA do WhatsApp.
-- Delega para create_order (013) e só neutraliza o rate limit por IP: a IA não
-- é um checkout público e não conhece o IP real de quem mandou a mensagem.
-- O dedup de 60s (mesmo telefone) continua valendo e evita pedido duplicado.
-- Validação, recálculo de preço e transação única vêm da create_order.
create or replace function ai_create_order(
  p_store_id uuid,
  p_type text,
  p_payment_method text,
  p_change_for_cents integer,
  p_notes text,
  p_address jsonb,
  p_items jsonb,
  p_total_cents integer,
  p_customer_name text,
  p_customer_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  return create_order(
    p_store_id, p_type, p_payment_method, p_change_for_cents, p_notes,
    p_address, p_items, p_total_cents,
    'ai:' || p_store_id::text || ':' || p_customer_phone,
    p_customer_name, p_customer_phone
  );
end;
$$;

revoke execute on function ai_create_order(uuid, text, text, integer, text, jsonb, jsonb, integer, text, text) from public, anon, authenticated;
grant  execute on function ai_create_order(uuid, text, text, integer, text, jsonb, jsonb, integer, text, text) to service_role;
