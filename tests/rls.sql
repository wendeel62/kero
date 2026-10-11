-- =====================================================================
-- tests/rls.sql — 9 asserções RLS (SPEC v3 §10, TEST-02 do backlog)
-- Uso (CI, stack local): psql "$DATABASE_URL" -v uid_a=.. -v uid_b=.. -f tests/rls.sql
--   uid_a/uid_b = ids de 2 usuários criados via Auth Admin API, com profiles
--   (role='loja') apontando p/ as lojas A/B criadas abaixo.
-- Metodologia SPEC §10: BEGIN explícito, `set local role` dentro da transação,
-- claims via variáveis psql, `raise 'FALHA'` FORA do `exception when others`,
-- ROLLBACK final (zero resíduo).
-- Qualquer FALHA aborta o script (ON_ERROR_STOP é ligado pelo workflow).
-- =====================================================================

\set ON_ERROR_STOP on

BEGIN;

-- =========== fixtures (dono postgres: bypassa RLS) ===========
-- lojas A (uid_a) e B (uid_b): ativas, whatsapp válido, open_hours {} (objeto vazio ok)
INSERT INTO stores (id, slug, name, whatsapp, open_hours, active)
VALUES
  (gen_random_uuid(), 'rls-loja-a', 'RLS Loja A', '92911110000', '{}', true),
  (gen_random_uuid(), 'rls-loja-b', 'RLS Loja B', '92911120000', '{}', true);

-- profiles dos lojistas de teste (FK auth.users satisfeita pelo workflow)
INSERT INTO profiles (id, store_id, role)
VALUES
  (:'uid_a'::uuid, (SELECT id FROM stores WHERE slug = 'rls-loja-a'), 'loja'),
  (:'uid_b'::uuid, (SELECT id FROM stores WHERE slug = 'rls-loja-b'), 'loja');

INSERT INTO categories (store_id, name, sort_order)
VALUES
  ((SELECT id FROM stores WHERE slug = 'rls-loja-a'), 'RLS Cat A', 0),
  ((SELECT id FROM stores WHERE slug = 'rls-loja-b'), 'RLS Cat B', 0);

-- pedido oA na loja A (status new) + item; pedido oB na loja B
INSERT INTO orders (store_id, code, customer_name, customer_phone, type, payment_method,
  subtotal_cents, delivery_fee_cents, total_cents, promised_at, status)
VALUES
  ((SELECT id FROM stores WHERE slug = 'rls-loja-a'), 'ABCD', 'RLS Cli A', '92988880000',
   'pickup', 'pix', 5000, 0, 5000, now() + interval '30 minutes', 'new'),
  ((SELECT id FROM stores WHERE slug = 'rls-loja-b'), 'EFGH', 'RLS Cli B', '92988890000',
   'pickup', 'pix', 6000, 0, 6000, now() + interval '30 minutes', 'new');

INSERT INTO order_items (order_id, name_snapshot, unit_price_cents, qty)
VALUES
  ((SELECT id FROM orders WHERE code = 'ABCD'), 'RLS Item', 5000, 1),
  ((SELECT id FROM orders WHERE code = 'EFGH'), 'RLS Item', 6000, 1);

-- claims do lojista A (auth.uid() = uid_a via request.jwt.claims)
-- NOTE: repetir este bloco trocando uid_a→uid_b p/ atuar como B (ver teste 3).

-- =========== 1. anon não lê orders ===========
SET LOCAL ROLE anon;
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM orders;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FALHA 1: anon lê orders (%)', v_n; END IF;
  RAISE NOTICE 'ok 1: anon não lê orders';
END $$;

-- =========== 2. anon não insere order ===========
SET LOCAL ROLE anon;
DO $$
BEGIN
  INSERT INTO orders (store_id, code, customer_name, customer_phone, type, payment_method,
    subtotal_cents, delivery_fee_cents, total_cents, promised_at)
  VALUES (
    (SELECT id FROM stores WHERE slug = 'rls-loja-a'), 'WXYZ', 'RLS X', '92988880000',
    'pickup', 'pix', 1000, 0, 1000, now() + interval '30 minutes');
  RAISE EXCEPTION 'FALHA 2: anon inseriu order';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
  RAISE NOTICE 'ok 2: anon não insere (%)', SQLERRM;
END $$;

-- =========== 3. lojista A não lê/escreve pedido da B (mas lê o seu) ===========
-- :uid_a cru (sem aspas) dentro do JSON; workflow passa via -v uid_a=...
SELECT set_config('request.jwt.claims',
  '{"sub":"' || :uid_a || '","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_own int; v_other int; v_upd int;
BEGIN
  SELECT count(*) INTO v_own FROM orders WHERE code = 'ABCD';
  SELECT count(*) INTO v_other FROM orders WHERE code = 'EFGH';
  IF v_own <> 1 THEN RAISE EXCEPTION 'FALHA 3a: A não lê o próprio (%).', v_own; END IF;
  IF v_other <> 0 THEN RAISE EXCEPTION 'FALHA 3b: A lê pedido da B (%).', v_other; END IF;
  UPDATE orders SET cancellation_reason = 'rls' WHERE code = 'EFGH';
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  IF v_upd <> 0 THEN RAISE EXCEPTION 'FALHA 3c: A escreveu pedido da B (%).', v_upd; END IF;
  RAISE NOTICE 'ok 3: A isolado da B';
END $$;

-- =========== 4. lojista não altera total_cents (column grant) ===========
DO $$
BEGIN
  UPDATE orders SET total_cents = 1 WHERE code = 'ABCD';
  RAISE EXCEPTION 'FALHA 4: A alterou total_cents';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%denied%' THEN RAISE EXCEPTION 'FALHA 4: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'ok 4: total_cents protegido (%)', SQLERRM;
END $$;

-- =========== 5. transição inválida bloqueada (new→delivered) ===========
DO $$
BEGIN
  PERFORM set_order_status((SELECT id FROM orders WHERE code = 'ABCD'), 'delivered', null, 'store');
  RAISE EXCEPTION 'FALHA 5: transição inválida passou';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%INVALID_TRANSITION%' THEN RAISE EXCEPTION 'FALHA 5: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'ok 5: transição inválida bloqueada';
END $$;

-- =========== 6. transição válida grava order_events com actor='store' ===========
DO $$
DECLARE v_ev int;
BEGIN
  PERFORM set_order_status((SELECT id FROM orders WHERE code = 'ABCD'), 'confirmed', null, 'store');
  SELECT count(*) INTO v_ev FROM order_events
    WHERE order_id = (SELECT id FROM orders WHERE code = 'ABCD')
      AND to_status = 'confirmed' AND actor = 'store';
  IF v_ev < 1 THEN RAISE EXCEPTION 'FALHA 6: evento store não gravado'; END IF;
  RAISE NOTICE 'ok 6: confirmed + evento store';
END $$;

-- =========== 7. lojista não altera active nem slug ===========
DO $$
BEGIN
  UPDATE stores SET active = false WHERE slug = 'rls-loja-a';
  RAISE EXCEPTION 'FALHA 7a: A alterou active';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%ACTIVE_ADMIN_ONLY%' THEN RAISE EXCEPTION 'FALHA 7a: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'ok 7a: active só via service_role';
END $$;
DO $$
BEGIN
  UPDATE stores SET slug = 'rls-hack' WHERE slug = 'rls-loja-a';
  RAISE EXCEPTION 'FALHA 7b: A alterou slug';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%SLUG_IMMUTABLE%' THEN RAISE EXCEPTION 'FALHA 7b: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'ok 7b: slug imutável';
END $$;

-- =========== 8. produto não aponta category_id de outra loja (FK composta) ===========
DO $$
BEGIN
  INSERT INTO products (store_id, category_id, name, price_cents)
  VALUES (
    (SELECT id FROM stores WHERE slug = 'rls-loja-a'),
    (SELECT id FROM categories WHERE name = 'RLS Cat B'),
    'RLS Hack', 1000);
  RAISE EXCEPTION 'FALHA 8: FK composta aceitou categoria da B';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%violates foreign key%' THEN RAISE EXCEPTION 'FALHA 8: erro inesperado: %', SQLERRM; END IF;
  RAISE NOTICE 'ok 8: FK composta barra cross-store';
END $$;

-- =========== 9. orders em pg_publication_tables (Realtime) ===========
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHA 9: orders fora da publicação'; END IF;
  RAISE NOTICE 'ok 9: orders no Realtime';
END $$;

ROLLBACK;
