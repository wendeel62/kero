-- 016_pdv.sql — RPC pdv_create_order (PDV do painel lojista)
-- Ação do lojista (não checkout público): sem rate-limit/dedup de IP.
-- Recalcula preço no servidor (idêntico ao create_order), trava mesa ocupada.

create or replace function pdv_create_order(
  p_store_id uuid,
  p_type text,
  p_table_id uuid,
  p_payment_method text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb               -- [{id:uuid, qty:int, addons:[uuid], notes:text}]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_store stores%rowtype;
  v_table dine_tables%rowtype;
  v_subtotal int := 0;
  v_code text;
  v_attempt int := 0;
  v_order_id uuid;
  v_item jsonb;
  v_prod products%rowtype;
  v_addon product_addons%rowtype;
  v_addon_id text;
  v_unit int;
  v_qty int;
  v_addons_out jsonb;
  v_items_out jsonb := '[]'::jsonb;
begin
  -- forma
  if p_type not in ('dine_in','pickup','delivery') then
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
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'TOO_MANY_LINES';
  end if;

  -- loja existe e está ativa
  select * into v_store from stores where id = p_store_id;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if not v_store.active then
    raise exception 'STORE_INACTIVE';
  end if;

  -- mesa: obrigatória para dine_in, deve existir e ser da loja, e estar livre
  if p_type = 'dine_in' then
    if p_table_id is null then
      raise exception 'MESA_INVALIDA';
    end if;
    select * into v_table from dine_tables
      where id = p_table_id and store_id = p_store_id and active;
    if not found then
      raise exception 'MESA_INVALIDA';
    end if;
    if exists (select 1 from orders
                where store_id = p_store_id
                  and table_id = p_table_id
                  and status in ('new','confirmed','preparing','ready','out')) then
      raise exception 'MESA_JA_OCUPADA';
    end if;
  end if;

  -- recálculo: servidor é a ÚNICA fonte de preço (idêntico ao create_order)
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
        v_addons_out := v_addons_out ||
          jsonb_build_object('name', v_addon.name, 'price_cents', v_addon.price_cents, 'is_separate', v_addon.is_separate);
      end loop;
      -- total por grupo: price_rule (sum/max/avg) + free_addons (primeiros X grátis)
      select coalesce(sum(grp_total), 0) into v_unit
      from (
        select
          case g.price_rule
            when 'max' then max(a.price_cents)
            when 'avg' then avg(a.price_cents)::int
            else (
              select coalesce(sum(a3.price_cents), 0)
              from (
                select a2.price_cents, row_number() over (order by a2.id) as rn
                from product_addons a2
                where a2.group_id = g.id and a2.store_id = p_store_id and a2.active
                  and (a2.product_id is null or a2.product_id = v_prod.id)
                  and a2.id in (select (e #>> '{}')::uuid from jsonb_array_elements(v_item->'addons') e)
              ) a3
              where a3.rn > coalesce(g.free_addons, 0)
            )
          end as grp_total
        from product_addon_groups g
        join product_addons a on a.group_id = g.id and a.store_id = p_store_id and a.active
          and (a.product_id is null or a.product_id = v_prod.id)
        where g.store_id = p_store_id
          and a.id in (select (e #>> '{}')::uuid from jsonb_array_elements(v_item->'addons') e)
        group by g.id, g.price_rule, g.free_addons
      ) sub;
      v_unit := v_prod.price_cents + v_unit;
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

  -- código 4 chars único por loja/dia, retry 6x
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
                          promised_at, status, table_id)
      values (p_store_id, v_code, p_customer_name, p_customer_phone, p_type,
              null, p_payment_method, null, null, null,
              v_subtotal, 0, v_subtotal,
              promise_time(v_store.prep_time_min, v_store.prep_time_max),
              'new', p_table_id)
      returning id into v_order_id;
      exit;
    exception when unique_violation then
      null;   -- colisão de code no dia: tenta outro
    end;
  end loop;

  -- itens (snapshot)
  insert into order_items(order_id, name_snapshot, unit_price_cents, qty, addons, notes)
  select v_order_id,
         e->>'name',
         (e->>'unit_price_cents')::int,
         (e->>'qty')::int,
         e->'addons',
         nullif(e->>'notes', '')
  from jsonb_array_elements(v_items_out) e;

  -- evento inicial: to_status 'new', actor 'store'
  insert into order_events(order_id, from_status, to_status, actor)
  values (v_order_id, null, 'new', 'store');

  return jsonb_build_object(
    'order_id', v_order_id,
    'code', v_code,
    'table_number', v_table.number
  );
end $$;

grant execute on function pdv_create_order(uuid, text, uuid, text, text, text, jsonb) to authenticated;
