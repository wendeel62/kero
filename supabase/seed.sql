-- =====================================================================
-- seed.sql — loja demo (DB-06, backlog)
-- Fonte: app/[slug]/menu-data.ts (única fonte do cardápio demo, DS §1 item 14)
-- Idempotente: UUIDs fixos + ON CONFLICT DO NOTHING (db reset não duplica)
-- image_url fica NULL de propósito: thumbs emoji são placeholder (DS §6)
-- =====================================================================

-- =========== loja demo ===========
insert into stores (id, slug, name, description, whatsapp, min_order_cents,
                    prep_time_min, prep_time_max, open_hours, active, force_closed)
values (
  '00000000-0000-0000-0000-000000000001',
  'pizza-do-joao',
  'Pizza do João',
  'Pizzas artesanais em forno a lenha',
  '5511999998888',
  2500, 30, 45,
  '{"0":[["11:00","23:00"]],"1":[["11:00","23:00"]],"2":[["11:00","23:00"]],
    "3":[["11:00","23:00"]],"4":[["11:00","23:00"]],"5":[["11:00","23:00"]],
    "6":[["11:00","23:00"]]}',
  true, false
)
on conflict (id) do nothing;

-- =========== bairros (SPEC §2.4: taxa por bairro; 0 ativos ⇒ pickup-only) ===========
insert into neighborhoods (id, store_id, name, fee_cents, active) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Centro',    500, true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Jardins',   750, true),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Vila Nova', 900, false)
on conflict (id) do nothing;

-- =========== categorias ===========
insert into categories (id, store_id, name, sort_order, active) values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'Pizzas',  0, true),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'Burgers', 1, true),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'Bebidas', 2, true)
on conflict (id) do nothing;

-- =========== produtos (menu-data: 18 itens; Guarana pausado) ===========
insert into products (id, store_id, category_id, name, description, price_cents, image_url, active, sort_order) values
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Margherita G',              'Molho de tomate, muçarela, manjericão fresco. Massa de fermentação lenta.', 4990, null, true,  0),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Calabresa G',               'Calabresa, cebola roxa, muçarela.',                                          5290, null, true,  1),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Margherita M',              'Versão média da clássica.',                                                  3990, null, true,  2),
  ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Portuguesa G',              'Presunto, ovo, cebola, ervilha, muçarela.',                                   5490, null, true,  3),
  ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Frango com Catupiry G',     'Frango desfiado, catupiry, milho.',                                          5590, null, true,  4),
  ('00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Quatro Queijos G',          'Muçarela, parmesão, gorgonzola, catupiry.',                                   5890, null, true,  5),
  ('00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Pepperoni G',               'Pepperoni, muçarela, orégano.',                                              5690, null, true,  6),
  ('00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Vegetariana G',             'Abobrinha, berinjela, pimentão, muçarela.',                                   5190, null, true,  7),
  ('00000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Chocolate com Morango G',   'Chocolate ao leite, morangos frescos.',                                       4790, null, true,  8),
  ('00000000-0000-0000-0000-00000000003a', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Romeu e Julieta G',         'Goiabada, queijo minas.',                                                     4590, null, true,  9),
  ('00000000-0000-0000-0000-00000000003b', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Atum G',                    'Atum, cebola, muçarela.',                                                     5390, null, true, 10),
  ('00000000-0000-0000-0000-00000000003c', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Baiana G',                  'Calabresa moída, pimenta, cebola.',                                          5490, null, true, 11),
  ('00000000-0000-0000-0000-00000000003d', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Lombo Canadense G',         'Lombo, cebola, muçarela.',                                                    5590, null, true, 12),
  ('00000000-0000-0000-0000-00000000003e', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Napolitana G',              'Muçarela, tomate, parmesão.',                                                 5090, null, true, 13),
  ('00000000-0000-0000-0000-00000000003f', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000022', 'Smash Duplo',               'Pão brioche, 2×90g, cheddar, picles.',                                        3290, null, true,  0),
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000022', 'Bacon Crispy',              'Blend 160g, bacon crocante, barbecue.',                                      3590, null, true,  1),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000023', 'Coca-Cola 350ml',           'Lata gelada.',                                                                690, null, true,  0),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000023', 'Guaraná 350ml',             'Lata gelada.',                                                                650, null, false, 1)
on conflict (id) do nothing;

-- =========== adicionais globais (product_id NULL = global, SPEC §5) ===========
insert into product_addons (id, store_id, product_id, name, price_cents, active) values
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000001', null, 'Bacon crocante',               600, true),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000001', null, 'Cheddar extra',                450, true),
  ('00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000001', null, 'Borda recheada de catupiry',   890, true)
on conflict (id) do nothing;
