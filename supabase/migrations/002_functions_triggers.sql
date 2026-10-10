-- =====================================================================
-- 002_functions_triggers.sql — funções + triggers (SPEC v3 §6)
-- Task: DB-03 (backlog) · Mapeamento das funções da SPEC §5/§6:
--   1. enforce_order_status_transition  (trg_enforce_order_status_transition)
--   2. protect_store_columns            (trg_protect_store_columns)
--   3. validate_open_hours              (trg_validate_open_hours)
--   4. set_order_status(p_order_id, p_to, p_reason, p_actor)
--   5. create_order(...) — transação do checkout (SPEC §7.3)
--   6. fn_check_order_items_limit       (trg_order_items_max_lines)
--   8. trg_enforce_max_products_loja    (fn_check_products_limit)
--   9. get_daily_salt()
--  10. calculate_ip_hash(ip)
--  11. promise_time(prep_min, prep_max)
-- Convenção de erro: mensagem começa com o CÓDIGO antes de ':' — a rota
-- (/api/orders) faz o parse e responde { error: { code, message } } (SPEC §11).
-- =====================================================================

-- =========== helpers de sessão ===========

-- store_id do profile autenticado (SPEC §6). Policies usam isso.
create or replace function auth_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from profiles where id = auth.uid()
$$;

-- =========== 11. promise_time (SPEC §2.27) ===========
-- now() + ceil((prep_min + prep_max) / 2) minutos (média arredondada p/ cima)
create or replace function promise_time(p_prep_min integer, p_prep_max integer)
returns timestamptz language plpgsql stable as $$
begin
  if p_prep_min is null or p_prep_max is null then
    raise exception 'STORE_NOT_CONFIGURED: tempo de preparo não definido';
  end if;
  return now() + interval '1 minute' * ceil((p_prep_min + p_prep_max)::numeric / 2);
end $$;

-- =========== 9. get_daily_salt (SPEC §2.22) ===========
-- Salt do dia (America/Manaus). Se faltar (cron desligado), cria na hora —
-- checkout nunca quebra por causa da rotação. Cron (API-05) mantém o normal.
create or replace function get_daily_salt() returns text
language plpgsql security definer set search_path = public as $$
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

-- =========== 10. calculate_ip_hash (SPEC §2.22) ===========
-- sha256(ip || salt diário) — o salt nunca sai do banco
-- ponytail: digest() do pgcrypto vive no schema extensions no Supabase —
-- search_path precisa incluí-lo, senão "function digest does not exist"
create or replace function calculate_ip_hash(p_ip text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select encode(digest(p_ip || get_daily_salt(), 'sha256'), 'hex')
$$;

-- =========== utilitários internos ===========

-- código 4 chars do alfabeto da SPEC §2.26 (sem I/L/O/0/1 → 31 chars)
create or replace function fn_random_code() returns text
language sql volatile as $$
  select string_agg(c, '') from (
    select substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1) as c
    from generate_series(1, 4)
  ) t
$$;

-- loja aberta AGORA? (SPEC §2.15) — open_hours "0".."6", 0=domingo (JS getDay), final inclusivo
create or replace function fn_store_is_open(p_hours jsonb) returns boolean
language plpgsql stable as $$
declare
  v_now time := (now() at time zone 'America/Manaus')::time;
  v_jsday text := (extract(isodow from (now() at time zone 'America/Manaus'))::int % 7)::text;
  v_range jsonb;
begin
  if jsonb_typeof(p_hours) <> 'object' then return false; end if;
  for v_range in select * from jsonb_array_elements(coalesce(p_hours -> v_jsday, '[]'::jsonb)) loop
    if v_now >= (v_range->>0)::time and v_now <= (v_range->>1)::time then
      return true;
    end if;
  end loop;
  return false;
end $$;

-- =========== 3. validate_open_hours (SPEC §2.19) ===========
create or replace function fn_validate_open_hours() returns trigger
language plpgsql as $$
declare
  v_day text;
  v_ranges jsonb;
  v_range jsonb;
begin
  if jsonb_typeof(new.open_hours) <> 'object' then
    raise exception 'INVALID_OPEN_HOURS: open_hours deve ser um objeto';
  end if;
  for v_day in select jsonb_object_keys(new.open_hours) loop
    if v_day not in ('0','1','2','3','4','5','6') then
      raise exception 'INVALID_OPEN_HOURS: chave "%" inválida (use "0".."6")', v_day;
    end if;
    v_ranges := new.open_hours -> v_day;
    if jsonb_typeof(v_ranges) <> 'array' or jsonb_array_length(v_ranges) > 3 then
      raise exception 'INVALID_OPEN_HOURS: máx 3 faixas/dia (%)', v_day;
    end if;
    for v_range in select * from jsonb_array_elements(v_ranges) loop
      if jsonb_typeof(v_range) <> 'array' or jsonb_array_length(v_range) <> 2 then
        raise exception 'INVALID_OPEN_HOURS: faixa deve ser ["HH:MM","HH:MM"]';
      end if;
      if v_range->>0 !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_range->>1 !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        raise exception 'INVALID_OPEN_HOURS: formato HH:MM inválido (%)', v_day;
      end if;
      if (v_range->>0)::time >= (v_range->>1)::time then
        raise exception 'INVALID_OPEN_HOURS: faixa final deve ser > inicial (meia-noite proibido v1)';
      end if;
    end loop;
  end loop;
  return new;
end $$;

create trigger trg_validate_open_hours
  before insert or update on stores
  for each row execute function fn_validate_open_hours();

-- =========== 2. protect_store_columns (SPEC §6) ===========
-- slug imutável p/ sempre; active só via operador (service_role)
create or replace function fn_protect_store_columns() returns trigger
language plpgsql as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'SLUG_IMMUTABLE: slug é imutável';
  end if;
  if new.active is distinct from old.active and auth.role() <> 'service_role' then
    raise exception 'ACTIVE_ADMIN_ONLY: active só muda via operador (service_role)';
  end if;
  -- ativação exige tempo de preparo configurado (Emenda v3.1 #9)
  if new.active = true and old.active = false
     and (new.prep_time_min is null or new.prep_time_max is null) then
    raise exception 'STORE_NOT_CONFIGURED: defina prep_time_min/max antes de ativar';
  end if;
  return new;
end $$;

create trigger trg_protect_store_columns
  before update on stores
  for each row execute function fn_protect_store_columns();

-- =========== 1. enforce_order_status_transition (SPEC §6) ===========
create or replace function fn_enforce_order_status_transition() returns trigger
language plpgsql as $$
declare
  v_actor text := coalesce(current_setting('app.actor', true), 'store');
  v_from text := old.status;
  v_to text := new.status;
begin
  -- delivered é final
  if v_from = 'delivered' and v_to <> 'delivered' then
    raise exception 'FINAL_STATE: delivered é final';
  end if;

  -- máquina de estados (SPEC §6): new→confirmed→preparing→ready|out→delivered; *→cancelled
  if v_from <> v_to and not (
       (v_from = 'new'       and v_to in ('confirmed','cancelled'))
    or (v_from = 'confirmed' and v_to in ('preparing','cancelled'))
    or (v_from = 'preparing' and v_to in ('ready','out','cancelled'))
    or (v_from = 'ready'     and v_to in ('delivered','cancelled'))
    or (v_from = 'out'       and v_to in ('delivered','cancelled'))
  ) then
    raise exception 'INVALID_TRANSITION: % → %', v_from, v_to;
  end if;

  -- colunas imutáveis do pedido
  if (new.store_id        is distinct from old.store_id)
    or (new.code          is distinct from old.code)
    or (new.tracking_token is distinct from old.tracking_token)
    or (new.subtotal_cents is distinct from old.subtotal_cents)
    or (new.total_cents   is distinct from old.total_cents) then
    raise exception 'IMMUTABLE_COLUMNS: colunas do pedido são imutáveis';
  end if;

  -- cancelamento exige motivo ≥3 chars + canceled_by (SPEC §2.21)
  if v_to = 'cancelled' and v_from <> 'cancelled' then
    if new.cancellation_reason is null or length(trim(new.cancellation_reason)) < 3 then
      raise exception 'REASON_REQUIRED: cancelamento exige motivo ≥3 chars';
    end if;
    if new.canceled_by is null then
      new.canceled_by := v_actor;
    end if;
  end if;

  return new;
end $$;

create trigger trg_enforce_order_status_transition
  before update on orders
  for each row execute function fn_enforce_order_status_transition();

-- registra order_events a cada transição — security definer p/ bypassar RLS
-- (lojista tem SELECT em order_events, não INSERT; este é o único ponto de escrita)
create or replace function fn_record_order_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into order_events(order_id, from_status, to_status, actor)
    values (new.id, old.status, new.status,
            coalesce(current_setting('app.actor', true), 'store'));
  end if;
  return new;
end $$;

create trigger trg_record_order_event
  after update on orders
  for each row execute function fn_record_order_event();

-- toca updated_at
create or replace function fn_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_touch_updated_at
  before update on orders
  for each row execute function fn_touch_updated_at();

-- =========== 6. limite de linhas por pedido (SPEC §11: máx 30) ===========
create or replace function fn_check_order_items_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from order_items where order_id = new.order_id) >= 30 then
    raise exception 'TOO_MANY_LINES: máx 30 linhas de itens por pedido';
  end if;
  return new;
end $$;

create trigger trg_order_items_max_lines
  before insert on order_items
  for each row execute function fn_check_order_items_limit();

-- =========== 8. teto de 200 produtos ativos por loja (SPEC §11) ===========
create or replace function fn_check_products_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from products where store_id = new.store_id and active) > 200 then
    raise exception 'PRODUCTS_LIMIT: máx 200 produtos ativos por loja';
  end if;
  return new;
end $$;

create trigger trg_enforce_max_products_loja
  after insert or update on products
  for each row execute function fn_check_products_limit();

-- =========== 4. set_order_status — ÚNICA via de transição (SPEC §6) ===========
create or replace function set_order_status(
  p_order_id uuid,
  p_to text,
  p_reason text default null,
  p_actor text default 'store'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid;
begin
  if p_actor not in ('store','customer','system') then
    raise exception 'INVALID_ACTOR: %', p_actor;
  end if;
  if p_to not in ('new','confirmed','preparing','ready','out','delivered','cancelled') then
    raise exception 'INVALID_STATUS: %', p_to;
  end if;

  -- actor='store' → lojista autenticado, só pedido da própria loja
  -- actor='customer'/'system' → só via service_role (rotas /api/*)
  if p_actor = 'store' then
    select store_id into v_store from orders where id = p_order_id;
    if v_store is null or v_store <> auth_store_id() then
      raise exception 'NOT_YOUR_STORE';
    end if;
  elsif auth.role() <> 'service_role' then
    raise exception 'ACTOR_FORBIDDEN: customer/system só via serviço';
  end if;

  perform set_config('app.actor', p_actor, true);   -- visível p/ os triggers

  update orders set
    status = p_to,
    cancellation_reason = case when p_to = 'cancelled'
                               then p_reason else cancellation_reason end,
    canceled_by = case when p_to = 'cancelled'
                       then coalesce(canceled_by, p_actor) else canceled_by end
  where id = p_order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  return p_order_id;
end $$;

-- =========== 5. create_order — transação do checkout (SPEC §7.3) ===========
-- Assinatura estendida vs. SPEC §5 (abreviada): inclui customer_name/phone
-- (NOT NULL em orders) e p_ip cru (hash calculado aqui, salt não sai do banco).
-- Honeypot fica na rota /api/orders (anti-bot de UI, não regra de negócio).
create or replace function create_order(
  p_store_id uuid,
  p_type text,
  p_payment_method text,
  p_change_for_cents integer,
  p_notes text,
  p_address jsonb,
  p_items jsonb,               -- [{id:uuid, qty:int, addons:[uuid], notes:text}]
  p_total_cents integer,       -- total do client — só p/ detectar PRICE_CHANGED
  p_ip text,
  p_customer_name text,
  p_customer_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_store stores%rowtype;
  v_nb neighborhoods%rowtype;
  v_ip_hash text;
  v_subtotal int := 0;
  v_fee int := 0;
  v_total int;
  v_code text;
  v_attempt int := 0;
  v_token uuid;    -- tracking_token (retorno da função)
  v_order_id uuid; -- orders.id (FK de itens/eventos) — NÃO é o token
  v_item jsonb;
  v_prod products%rowtype;
  v_addon product_addons%rowtype;
  v_addon_id text;
  v_unit int;
  v_qty int;
  v_addons_out jsonb;
  v_items_out jsonb := '[]'::jsonb;
  v_address jsonb := null;
  v_pix_key text := null;
begin
  -- forma
  if p_type not in ('delivery','pickup') then
    raise exception 'INVALID_TYPE';
  end if;
  if p_payment_method not in ('cash','pix','card_machine') then
    raise exception 'INVALID_PAYMENT';
  end if;
  if p_customer_name is null or length(p_customer_name) < 2 or length(p_customer_name) > 80 then
    raise exception 'INVALID_NAME';
  end if;
  if p_customer_phone is null or p_customer_phone !~ '^[0-9]{10,15}$' then
    raise exception 'INVALID_PHONE';
  end if;
  if p_notes is not null and length(p_notes) > 300 then
    raise exception 'NOTES_TOO_LONG';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'TOO_MANY_LINES';
  end if;

  -- loja existe e está ativa (vitrine dá 404; aqui a garantia dupla)
  select * into v_store from stores where id = p_store_id;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if not v_store.active then
    raise exception 'STORE_INACTIVE';
  end if;

  -- rate limit 5/h/IP/loja — conta pedidos criados com sucesso (SPEC §2.22)
  v_ip_hash := calculate_ip_hash(p_ip);
  if (select count(*) from orders
        where store_id = p_store_id
          and ip_hash = v_ip_hash
          and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMIT';
  end if;

  -- dedup 60s mesmo telefone+loja (SPEC §2.18) — 409 SEM token (a rota cuida)
  if exists (select 1 from orders
              where store_id = p_store_id
                and customer_phone = p_customer_phone
                and created_at > now() - interval '60 seconds') then
    raise exception 'DUPLICATE';
  end if;

  -- loja aberta? (SPEC §2.15)
  if v_store.force_closed or not fn_store_is_open(v_store.open_hours) then
    raise exception 'STORE_CLOSED';
  end if;

  -- bairro ativo ou pickup-only (SPEC §3.1: 0 bairros ativos ⇒ pickup-only)
  if p_type = 'delivery' then
    if (select count(*) from neighborhoods where store_id = p_store_id and active) = 0 then
      raise exception 'BAIRROS_NAO_CONFIGURADOS';
    end if;
    if p_address is null or (p_address->>'neighborhood_id') is null then
      raise exception 'ADDRESS_REQUIRED';
    end if;
    if (p_address->>'cep') is null or p_address->>'cep' !~ '^[0-9]{8}$' then
      raise exception 'INVALID_CEP';
    end if;
    select * into v_nb from neighborhoods
      where id = (p_address->>'neighborhood_id')::uuid
        and store_id = p_store_id and active;
    if not found then
      raise exception 'NEIGHBORHOOD_INVALID';
    end if;
    v_fee := v_nb.fee_cents;
    v_address := jsonb_set(p_address, '{neighborhood_name}', to_jsonb(v_nb.name));
  end if;

  -- recálculo: servidor é a ÚNICA fonte de preço (SPEC §2.10)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products
      where id = (v_item->>'id')::uuid and store_id = p_store_id;
    if not found then
      raise exception 'ITEM_UNAVAILABLE: %', v_item->>'id';
    end if;
    if not v_prod.active then
      raise exception 'ITEM_UNAVAILABLE: %', v_prod.name;
    end if;

    v_unit := v_prod.price_cents;
    v_addons_out := '[]'::jsonb;
    if jsonb_typeof(coalesce(v_item->'addons', '[]'::jsonb)) = 'array' then
      for v_addon_id in select a #>> '{}' from jsonb_array_elements(v_item->'addons') a loop
        select * into v_addon from product_addons
          where id = v_addon_id::uuid
            and store_id = p_store_id and active
            and (product_id is null or product_id = v_prod.id);
        if not found then
          raise exception 'ITEM_UNAVAILABLE: adicional de %', v_prod.name;
        end if;
        v_unit := v_unit + v_addon.price_cents;
        v_addons_out := v_addons_out ||
          jsonb_build_object('name', v_addon.name, 'price_cents', v_addon.price_cents);
      end loop;
    end if;

    v_qty := least(greatest(coalesce((v_item->>'qty')::int, 1), 1), 20);   -- clamp 1..20
    v_subtotal := v_subtotal + v_unit * v_qty;

    v_items_out := v_items_out || jsonb_build_object(
      'name', v_prod.name,
      'unit_price_cents', v_unit,
      'qty', v_qty,
      'addons', v_addons_out,
      'notes', v_item->>'notes'
    );
  end loop;

  v_total := v_subtotal + v_fee;

  -- divergência de preço (SPEC §7.3g): nunca grava preço velho
  if p_total_cents is not null and p_total_cents <> v_total then
    raise exception 'PRICE_CHANGED: original=% corrigido=%', p_total_cents, v_total;
  end if;

  -- pedido mínimo sobre o SUBTOTAL (SPEC §2.20)
  if v_subtotal < v_store.min_order_cents then
    raise exception 'MIN_ORDER';
  end if;

  -- troco (SPEC §2.30): cash exige change_for >= total; demais métodos → NULL
  if p_payment_method = 'cash' then
    if p_change_for_cents is null or p_change_for_cents < v_total then
      raise exception 'TROCO_INSUFICIENTE';
    end if;
  else
    p_change_for_cents := null;
    v_pix_key := case when p_payment_method = 'pix' then v_store.pix_key end;
  end if;

  -- código 4 chars único por loja/dia, retry 6x (SPEC §2.26)
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 6 then
      raise exception 'CODE_EXHAUSTED';
    end if;
    v_code := fn_random_code();
    begin
      insert into orders (store_id, code, customer_name, customer_phone, type,
                          address, payment_method, change_for_cents, pix_key, notes,
                          subtotal_cents, delivery_fee_cents, total_cents,
                          promised_at, status, ip_hash)
      values (p_store_id, v_code, p_customer_name, p_customer_phone, p_type,
              v_address, p_payment_method, p_change_for_cents, v_pix_key, p_notes,
              v_subtotal, v_fee, v_total,
              promise_time(v_store.prep_time_min, v_store.prep_time_max),
              'new', v_ip_hash)
      returning id, tracking_token into v_order_id, v_token;
      exit;
    exception when unique_violation then
      v_token := null;   -- colisão de code no dia: tenta outro
    end;
  end loop;

  -- itens (snapshot) — trigger trg_order_items_max_lines é a garantia final
  insert into order_items(order_id, name_snapshot, unit_price_cents, qty, addons, notes)
  select v_order_id,
         e->>'name',
         (e->>'unit_price_cents')::int,
         (e->>'qty')::int,
         e->'addons',
         nullif(e->>'notes', '')
  from jsonb_array_elements(v_items_out) e;

  -- evento inicial (SPEC §5): to_status 'new', actor 'customer'
  insert into order_events(order_id, from_status, to_status, actor)
  values (v_order_id, null, 'new', 'customer');

  return v_token;
end $$;

-- =========== auto-cancel new > 24h (SPEC §2.29) ===========
-- Chamado pelo cron diário (API-05) com service_role.
create or replace function auto_cancel_stale_orders() returns integer
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', 'system', true);
  update orders set status = 'cancelled',
                    cancellation_reason = 'timeout_24h',
                    canceled_by = 'system'
  where status = 'new'
    and created_at < now() - interval '24 hours';
  return sql%rowcount;
end $$;
