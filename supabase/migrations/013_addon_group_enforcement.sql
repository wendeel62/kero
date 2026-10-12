-- 013_addon_group_enforcement.sql — trava de grupo no servidor.
-- Recria create_order com a validacao de obrigatorio/maximo de escolhas dentro do
-- laco de itens. A UI valida antes (lib/addon-groups.ts); o banco NAO confia nela.
-- Um grupo incide sobre o produto se tem ao menos um adicional ativo aplicavel
-- (global ou do produto) — sem isso, um grupo obrigatorio cujo unico adicional foi
-- desativado travaria a venda.
-- O resto do corpo e IDENTICO ao da 002. O grant execute a service_role persiste
-- (create or replace nao derruba o grant).

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
  v_grp product_addon_groups%rowtype;
  v_chosen int;
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

    -- 012: regras de grupo. Um grupo incide sobre o produto se tem ao menos um
    -- adicional ativo global ou do produto (Review Focus #3).
    if jsonb_typeof(coalesce(v_item->'addons', '[]'::jsonb)) = 'array' then
      for v_grp in
        select g.* from product_addon_groups g
        where g.store_id = p_store_id
          and exists (
            select 1 from product_addons a
            where a.group_id = g.id and a.store_id = p_store_id and a.active
              and (a.product_id is null or a.product_id = v_prod.id)
          )
        order by g.sort_order
      loop
        select count(*) into v_chosen
        from product_addons a
        where a.store_id = p_store_id and a.group_id = v_grp.id
          and a.id in (select (e #>> '{}')::uuid from jsonb_array_elements(v_item->'addons') e);

        if v_grp.required and v_chosen = 0 then
          raise exception 'GROUP_REQUIRED: %', v_grp.name;
        end if;
        if v_grp.max_choices is not null and v_chosen > v_grp.max_choices then
          raise exception 'GROUP_MAX_CHOICES: % (max %)', v_grp.name, v_grp.max_choices;
        end if;
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
