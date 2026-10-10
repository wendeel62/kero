# Kero — SaaS Delivery White-Label (SPEC v3)

**Fonte de verdade absoluta. Único documento. Substitui v2 + emendas + plano.**

---

## 1. Propósito

Plataforma SaaS white-label por restaurante: cada loja tem vitrine própria (`kero.app/pizza-do-joao`), cardápio, pedidos e painel. **Não é marketplace.**

**Usuários:**
1. **Cliente final** — pede na vitrine, sem login.
2. **Lojista** — gerencia cardápio e pedidos no painel autenticado.
3. **Operador** — cria/desativa lojas via admin.

**Critério de sucesso (binário):** 1 loja real opera 1 dia inteiro de delivery — ≥30 pedidos aceitos, 30 entregues, 0 erro de checkout, 0 falha no teste de RLS.

---

## 2. Decisões Travadas (30)

| # | Decisão | Valor |
|---|---|---|
| 1 | Modelo | White-label por restaurante (nunca marketplace) |
| 2 | Canal do cliente | Cardápio online + carrinho + checkout → pedido cai no painel |
| 3 | Pagamento do pedido | **Só na entrega/retirada** (dinheiro, Pix na hora, maquininha) — **zero gateway v1** |
| 4 | Taxa de entrega | Por bairro, cadastrada pela loja; cliente escolhe no checkout |
| 5 | Notificação de pedido | Painel Realtime + som + badge na aba; fallback polling 30s |
| 6 | Cobrança do SaaS | Fase 2 — v1: flag `active` manual no admin |
| 7 | Stack | Next.js 15 App Router + TS + Supabase (Postgres + Auth + Storage + Realtime) + Tailwind/shadcn + Vercel |
| 8 | Arquitetura | Monolito Next.js único, tenants por path `/[slug]`, **uma base Postgres com `store_id` + RLS** |
| 9 | Dinheiro | Sempre centavos `integer` — **nunca float** |
|10 | Totais | Recalculados no servidor; client é só exibição |
|11 | Cliente final | **Sem login** — acompanhamento por link com `tracking_token` uuid |
|12 | Tamanhos de pizza | Produtos separados ("Margherita G/M"); adicionais usam `product_addons` |
|13 | Fuso | Grava UTC; exibe `America/Manaus` (para horários de loja e kanban) |
|14 | Idioma | PT-BR em toda UI |
|15 | Loja aberta | `active AND NOT force_closed AND dentro do open_hours(zone America/Manaus)` |
|16 | Canal de aviso | **Painel aberto é requisito** (sem push/e-mail/SMS v1) — risco nº 1 |
|17 | Loja inativa | **404** para o público (não vaza existência) |
|18 | Pedido duplicado | Mesmo telefone+loja < 60s → **409 sem devolver token** (link wa.me) |
|19 | Horário meia-noite | **Proibido v1** — faixa final deve ser > inicial; máx 3 faixas/dia |
|20 | Pedido mínimo | Compara com **subtotal** (antes da taxa); vale para entrega e retirada |
|21 | Cancelamento cliente | `new`/`confirmed` pode cancelar com motivo (`canceled_by='customer'`) |
|22 | Rate limit | **5 pedidos/hora/IP/loja** via `ip_hash` (sha256 IP + salt diário) — conta pedidos criados com sucesso |
|23 | LGPD | Anonimiza nome, telefone, endereço **e notas**; `anonymized_at`; retenção > 90 dias |
|24 | Impressão | **Bobina 80mm** padrão (`@page { size: 80mm auto }`); A4 só relatório |
|25 | Estoque | `active` = interruptor definitivo; estoque limitado fora de escopo |
|26 | Código do pedido | 4 chars, alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, **único por loja por dia** (UTC America/Manaus) |
|27 | Prometida de entrega (`promised_at`) | `now() + interval '1 minute' * ceil((prep_time_min + prep_time_max) / 2)` (média arredondada para cima) |
|28 | Senha provisória do lojista | Admin cria usuário via Supabase Auth Admin API com e-mail do lojista (fora de escopo v1) e senha gerada; senha mostrada uma vez ao operador; lojista pode redefinir via "Esqueci minha senha" (flow de e-mail fora v1). |
|29 | Cancelamento automático do sistema | Pedidos em status `new` há mais de 24h são automaticamente cancelados pelo sistema (`canceled_by='system'`, motivo `timeout_24h`). |
|30 | Validação de troco | Se `payment_method='cash'` então `change_for_cents >= total_cents`; caso contrário `change_for_cents` deve ser `NULL`. |

---

## 3. Escopo

### 3.1 Dentro (v1)

- Vitrine pública por loja: cardápio por categorias, busca client-side (acents-insensitive, case-insensitive), 12 itens/categoria + "Ver mais", teto 200 produtos/loja
- Checkout: nome, WhatsApp, entrega/retirada, endereço + bairro (select ativos), forma de pagamento, troco, observações, **CEP obrigatório somente em entrega** (emenda v3.1 #7)
- Pedido mínimo validado no servidor
- Horário de funcionamento: fora do horário → banner + checkout desabilitado
- **Painel lojista** (Supabase Auth):
  - Kanban: `new → confirmed → preparing → ready/out → delivered` (+ `cancelled` colapsado)
  - Janela: **não finalizados + hoje** (hoje definido por America/Manaus); contador real de cancelados de hoje
  - Alertas: som + toast + badge "N aguardando ação" + contador no título/favicon da aba
  - CRUD categorias, produtos (foto WebP ≤1MB, preço, descrição, disponibilidade), adicionais (por produto/globais)
  - CRUD bairros + taxas; pedido mínimo; tempo de preparo
  - Configurações: dados, logo, WhatsApp, `pix_key`, horários, bairros
- **Admin operador**: criar loja (slug + dono + senha provisória), ativar/desativar, reset senha, **anonimizar pedido**, listar pedidos da loja para anonimização
- Anti-abuso: honeypot (campo oculto chamado `website`) + dedup 60s (409 sem token) + rate limit 5/h/IP/loja (contagem de pedidos criados com sucesso)
- Fotos: WebP client-side ≤1MB antes do upload (redimensionamento para largura máxima 1200px, qualidade 80-100 via canvas)
- LGPD: aviso no checkout; anonimização sob demanda (nome, telefone, endereço, **notas**)

### 3.2 Fora (explícito, fase 2+)

Gateway de pagamento, billing/assinatura, app nativo, PWA push, e-mail/SMS, login cliente, histórico cliente, subdomínio/domínio próprio, cupons/promoções, fidelidade, entrega por raio/km (Google Maps), relatórios/dashboards, multi-usuário com UI de convite, pedido agendado, NFC-e/comprovante, gorjeta, taxa de serviço, estoque limitado, feriados/exceções, "pedir de novo".

---

## 4. Arquitetura

```
app/
├── (public)/[slug]/
│   ├── page.tsx                     vitrine SSR (cardápio, categorias, busca client-side)
│   ├── produto/[id]/page.tsx        detalhe + adicionais
│   ├── carrinho/page.tsx            carrinho (localStorage por slug)
│   ├── checkout/page.tsx            form + CEP + bairro + pagamento-na-entrega
│   └── pedido/[token]/page.tsx      acompanhamento SSR + polling 15s + cancelar
├── login/page.tsx                   login lojista + login-client.tsx (emenda v3.1 #6)
├── (dash)/painel/                   (emenda v3.1 #3 — era "(painel)")
│   ├── page.tsx                     Hoje (resumo + toggle force_closed)
│   ├── pedidos/page.tsx             kanban (não finalizados + hoje)
│   ├── pedidos/[id]/page.tsx        detalhe + ações
│   ├── cardapio/page.tsx            categorias + produtos + adicionais globais
│   ├── cardapio/produtos/[id]/page.tsx  form produto + adicionais
│   └── configuracoes/page.tsx       abas: Loja | Horários | Entrega
├── (print)/painel/
│   └── pedidos/[id]/print/page.tsx  cupom 80mm (emenda v3.1 #3 — route group próprio)
├── (admin)/admin/
│   ├── page.tsx                     → /admin/lojas
│   ├── lojas/page.tsx               lista + criar loja
│   └── lojas/[id]/page.tsx          detalhe + toggle active + reset senha + anonimizar pedido
└── api/
    ├── orders/route.ts              POST checkout (service role)
    ├── orders/[id]/status/route.ts  PATCH status (set_order_status RPC)
    ├── orders/track/[token]/route.ts  GET acompanhamento + POST cancelar (emenda v3.1 #2)
    ├── cron/daily-salt/route.ts     salt do dia + auto-cancel 24h (API-05)
    └── admin/orders/[id]/anonymize/route.ts  LGPD anonimização (service role)

lib/
├── pricing.ts      ÚNICA fonte de totais (centavos int, server + client)
├── order-status.ts Máquina de estados (canTransition, nextStatus, rótulos PT-BR)
├── store-hours.ts  isStoreOpen / nextOpeningLabel (TZ America/Manaus)
├── cart.ts         Operações puras do carrinho
├── code.ts         Código curto 4 chars (alfabeto sem I/L/O/0/1 — emenda v3.1 #5)
├── wa.ts           Links wa.me (normaliza dígitos, 55 default)
├── image.ts        WebP ≤1MB client-side (pickQuality, shouldRejectType puros)
├── queries.ts      Leituras da vitrine (via RLS)
├── auth.ts         requireStore / requireAdmin
└── supabase/       client.ts | server.ts | admin.ts (service role — SÓ server-side)

storage/
├── buckets/
│   └── store-assets/
│       ├── logos/      (logos/{store_id}/logo.webp — emenda v3.1 #4)
│       └── products/   (products/{store_id}/{product_id}.webp — emenda v3.1 #4)
```

**Rotas server-side (service role):**
1. `POST /api/orders` — checkout (validações, recalc, rate limit, dedup, transação via RPC `create_order`)
2. `PATCH /api/orders/[id]/status` — `set_order_status` RPC (`actor='store'`)
3. `POST /api/orders/track/[token]` — cancelar pelo cliente (mesma rota do GET; `set_order_status(..., 'customer')`)
4. `GET /api/orders/track/[token]` — tracking público (mascarado, `promised_at`, `canCancel`)
5. Admin: stores CRUD + anonimização
6. `POST /api/admin/orders/[id]/anonymize` — LGPD anonimização (service role)

**Realtime:** `alter publication supabase_realtime add table orders;` — sem isso o kanban não recebe eventos. Painel assina `orders` filtrado por `store_id`. Tracking usa polling 15s (RLS impede anon no realtime).

---

## 5. Modelo de Dados

```sql
-- extensions
create extension if not exists pgcrypto;

-- stores
create table stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),   -- IMUTÁVEL
  name text not null,
  logo_url text,
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  description text,
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  prep_time_min integer, prep_time_max integer,
  open_hours jsonb not null,      -- "0".."6" → ≤3 faixas ["11:00","14:00"]; final > inicial
  active boolean not null default false,
  force_closed boolean not null default false,
  force_closed_at timestamptz,
  pix_key text,
  created_at timestamptz not null default now()
);

-- profiles (Auth users linked to stores)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  store_id uuid references stores on delete set null,   -- null for admins
  role text not null check (role in ('loja','admin')) default 'loja',
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- daily salt for ip_hash (rotated via cron at 00:00 America/Manaus)
create table daily_salt (
  day date primary key,   -- day in America/Manaus timezone
  salt text not null
);
create index idx_daily_salt_day on daily_salt(day);

-- categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null, sort_order integer not null default 0,
  active boolean not null default true,
  unique (id, store_id)
);

-- products
create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  category_id uuid not null,
  name text not null, description text,
  price_cents integer not null check (price_cents >= 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique (id, store_id),
  foreign key (category_id, store_id) references categories (id, store_id)
);

-- product_addons
create table product_addons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  product_id uuid,                      -- null = global
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  unique (id, store_id),
  foreign key (product_id, store_id) references products (id, store_id)
);

-- neighborhoods
create table neighborhoods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null,
  fee_cents integer not null default 0 check (fee_cents >= 0),
  active boolean not null default true,
  unique (store_id, name)
);

-- orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  code text not null check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$'),
  tracking_token uuid not null unique default gen_random_uuid(),
  customer_name text not null check (length(customer_name) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,15}$'),
  type text not null check (type in ('delivery','pickup')),
  address jsonb,          -- entrega: { street, number, complement, cep, neighborhood_id, neighborhood_name } (sem "reference" — emenda v3.1 #17)
                           -- retirada: null
                           -- cep obrigatório (8 dígitos); bairro + nome = snapshot
  payment_method text not null check (payment_method in ('cash','pix','card_machine')),
  change_for_cents integer,
  pix_key text,
  notes text check (notes is null or length(notes) <= 300),
  subtotal_cents integer not null,
  delivery_fee_cents integer not null default 0,
  total_cents integer not null,
  promised_at timestamptz not null,
  status text not null default 'new'
    check (status in ('new','confirmed','preparing','ready','out','delivered','cancelled')),
  cancellation_reason text,
  canceled_by text check (canceled_by in ('store','customer','system')),
  anonymized_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code, (created_at at time zone 'America/Manaus')::date)
);

-- order_items
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  name_snapshot text not null,
  unit_price_cents integer not null,
  qty integer not null check (qty between 1 and 20),
  addons jsonb not null default '[]'::jsonb,   -- [{name:string, price_cents:int}]
  notes text check (notes is null or length(notes) <= 200)
);
-- máximo 30 linhas de itens por pedido (regra de negócio)
create trigger trg_order_items_max_lines
before insert on order_items
for each row
execute function fn_check_order_items_limit();

-- order_events
create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  from_status text, to_status text not null,
  actor text not null default 'store' check (actor in ('store','customer','system')),
  created_at timestamptz not null default now()
);

-- índices
create index idx_orders_store_status_created on orders(store_id, status, created_at desc);
create index idx_orders_store_created on orders(store_id, created_at desc);
create index idx_orders_store_phone_created on orders(store_id, customer_phone, created_at desc);
create index idx_orders_store_ip_created on orders(store_id, ip_hash, created_at desc);
create index idx_order_items_order on order_items(order_id);
create index idx_order_events_order on order_events(order_id, created_at);
create index idx_categories_store on categories(store_id);
create index idx_products_store on products(store_id);
create index idx_products_category_store on products(category_id, store_id);
create index idx_addons_store on product_addons(store_id);
create index idx_addons_product_store on product_addons(product_id, store_id);
create index idx_neighborhoods_store on neighborhoods(store_id);

-- funções e triggers
-- 1. enforce_order_status_transition (valida máquina, exige motivo ≥3 chars em cancelled, grava order_events)
-- 2. protect_store_columns (active só via service_role; slug imutável)
-- 3. validate_open_hours (faixa final > inicial; máx 3 faixas/dia; formato HH:MM)
-- 4. set_order_status(p_order_id, p_to, p_reason, p_actor) — única via de transição (security definer, service role/ authenticated); valida actor, canTransition, grava evento com actor.
-- 5. create_order(p_store_id, p_type, p_payment_method, p_change_for_cents, p_pix_key, p_notes, p_subtotal_cents, p_delivery_fee_cents, p_total_cents, p_address_jsonb, p_items_jsonb, p_ip_hash) — transação que:
--    - verifica honeypot vazio
--    - aplica rate limit contando orders recentes (última 1h) pelo mesmo store_id e ip_hash
--    - aplica dedup 60s: mesma store_id + customer_phone + created_at < agora - interval '60 seconds' → 409 sem token
--    - verifica loja active e aberta (senão 409)
--    - verifica bairro ativo ou pickup-only (0 bairros ativos = pickup-only)
--    - recalcula subtotal, entrega, total via pricing.ts (ignora valores do cliente)
--    - se houver diferença de preço → levanta exceção price_changed com campos original e corrigido
--    - senão: insere orders (inclui promised_at via promise_time, ip_hash via calculate_ip_hash) + order_items + order_events('new', actor='customer')
--    - retorna tracking_token do pedido inserido
-- 6. fn_check_order_items_limit() — conta linhas de order_items para o NEW.order_id; se > 30 levanta exceção.
-- 7. Triggers de validação de FK composta (já definido por foreign key com (id, store_id)).
-- 8. Trigger trg_enforce_max_products_loja — após insert/update em products, conta ativos por loja; se >200 levanta exceção.
-- 9. get_daily_salt() — retorna salt do dia (America/Manaus) para cálculo de ip_hash
-- 10. calculate_ip_hash(ip inet) — retorna sha256(ip::text || get_daily_salt())
-- 11. promise_time(prep_min int, prep_max int) — retorna promised_at conforme regra 27
```

*(Detalhes das funções e triggers omitidos por brevidade, mas devem seguir as regras descritas.)*

---

## 6. Auth & RLS

- **Lojista/staff**: Supabase Auth email/senha → `profiles.store_id` define a loja
- **Operador**: `profiles.role='admin'`
- **Cliente final**: anônimo

**Helper:** `auth_store_id()` → `store_id` do profile autenticado. Todas policies usam isso.

| Tabela | Anon | Lojista | Admin |
|---|---|---|---|
| stores, categories, products, addons, neighborhoods | SELECT `active=true` | ALL próprio `store_id` | service role |
| profiles | nada | SELECT própria linha | service role |
| orders, order_items, order_events | **nada** (público só via `/api/orders/track/[token]`) | SELECT próprio `store_id`; UPDATE só colunas permitidas | service role |

**Column grants (obrigatório — RLS não filtra coluna):**
```sql
revoke update on orders from authenticated;
grant update (status, cancellation_reason, canceled_by, updated_at) on orders to authenticated;
```

**Triggers (autoridade final):**
1. `enforce_order_status_transition` — valida máquina de estados, exige motivo ≥3 chars em `cancelled`, recusa colunas imutáveis, grava `order_events` com `actor` via `current_setting('app.actor', true)` (default `'store'`).
2. `protect_store_columns` — `active` só via `service_role`; **`slug` imutável** para sempre.
3. `validate_open_hours` — faixa final > inicial; máx 3 faixas/dia; formato HH:MM.
4. `set_order_status(p_order_id, p_to, p_reason, p_actor)` — **única via** de transição (security definer, service role/ authenticated); valida `actor`, `canTransition`, grava evento com `actor`.
5. `create_order(p_store_id, p_type, p_payment_method, p_change_for_cents, p_pix_key, p_notes, p_subtotal_cents, p_delivery_fee_cents, p_total_cents, p_address_jsonb, p_items_jsonb, p_ip_hash)` — **transação** que:
   - verifica honeypot vazio
   - aplica rate limit contando `orders` recentes (última 1h) pelo mesmo `store_id` e `ip_hash`
   - aplica dedup 60s: mesma `store_id` + `customer_phone` + `created_at` < agora - interval '60 seconds' → 409 sem token
   - verifica loja `active` e aberta (senão 409)
   - verifica bairro ativo ou pickup-only (0 bairros ativos = pickup-only)
   - recalcula subtotal, entrega, total via `pricing.ts` (ignora valores do cliente)
   - se houver diferença de preço → levanta exceção `price_changed` com campos `original` e `corrigido`
   - senão: insere `orders` (inclui `promised_at` via `promise_time`, `ip_hash` via `calculate_ip_hash`) + `order_items` + `order_events('new', actor='customer')`
   - retorna `tracking_token` do pedido inserido
6. `fn_check_order_items_limit()` — conta linhas de `order_items` para o `NEW.order_id`; se > 30 levanta exceção.
7. Triggers de validação de FK composta (já definido por `foreign key` com `(id, store_id)`).
8. Trigger `trg_enforce_max_products_loja` — após insert/update em `products`, conta ativos por loja; se >200 levanta exceção.

**Máquina de estados:**
```
new → confirmed → preparing → ready      (retirada) → delivered
                         ↘ out        (entrega)  ↗
qualquer (exceto delivered) → cancelled   (loja ou cliente ou sistema)
delivered = final
```

**Uma verdade só:** UI transiciona via rota server-side → RPC `set_order_status`; trigger é a garantia final.

---

## 7. Fluxo do Pedido

1. Cliente abre vitrine → SSR cardápio. `active=false` → 404. Fora de `open_hours` → banner + checkout desabilitado.
2. Monta carrinho (localStorage) → checkout: nome, WhatsApp, entrega/retirada, endereço + bairro (select), pagamento, troco, obs.
3. `POST /api/orders` (service role) — ordem:
   a) honeypot vazio
   b) **rate limit 5/h/IP/loja** (429) usando `ip_hash` (calculado com `get_daily_salt()`)
   c) dedup 60s → **409 sem token**, mensagem + wa.me
   d) loja `active` e aberta (409)
   e) bairro ativo ou **pickup-only** (0 bairros = pickup-only)
   f) **recalcula tudo** via `pricing.ts` (ignora total do cliente)
   g) divergência → levanta exceção `price_changed` com `{original_total, corrected_total}` → cliente confirma → reenvia com campo `confirmedPriceDiff=true`
   h) `create_order` grava orders + order_items + `order_events('new', actor='customer')` numa transação, com `promised_at` e `ip_hash`
   i) responde `tracking_token` **apenas do pedido recém-criado**
4. Cliente → `/[slug]/pedido/[token]`: status, `promised_at` ("chega ~19:40"), timeline (com `actor`), itens, total, botão wa.me, **botão "Cancelar" em `new`/`confirmed`**.
5. Painel: Realtime → toast + som + badge "aguardando ação" → `confirmed → preparing → ready|out → delivered`. Badge na aba em background.
6. Cancelamento exige motivo ≥3 chars + `canceled_by`. `delivered` = final. Cliente cancela só em `new`/`confirmed` (via `set_order_status(..., 'customer')`). Sistema cancela automaticamente `new` > 24h (`canceled_by='system'`).

---

## 8. Telas (painel — 6 telas, sidebar fixa)

1. **`/painel` — Hoje**: cards (Pedidos hoje, Faturamento hoje exclui cancelados, Ticket médio, Aguardando ação badge), últimos 5 pedidos, toggle **Fechar agora** (`force_closed` + `force_closed_at`), banner "Fechada desde HH:MM" + "Reabrir".
2. **`/painel/pedidos` — Kanban**: janela **não finalizados + hoje**; colunas `new → confirmed → preparing → ready/out → delivered`; "Cancelados (hoje)" colapsada com contador real; card: código 4 chars, nome, tempo decorrido (vermelho após 10 min em `new`), "Aguardando X min" em `new`, `formatBRL`, badges entrega/retirada/pagamento; botão "Avançar" (`nextStatus` incl. `confirmed→preparing`), "Cancelar" (diálogo motivo ≥3).
3. **`/painel/pedidos/[id]` — Detalhe**: cliente (nome + wa.me), itens snapshot + addons + obs, endereço/retirada, pagamento + troco, timeline (`order_events` com `STATUS_LABEL` + `actor`), ações: avançar, cancelar, **imprimir 80mm**.
4. **`/painel/cardapio`**: categorias ordenáveis (drag-and-drop); cards produto (foto, nome, preço, toggle disponível); botões nova categoria / novo produto; tabela adicionais globais.
5. **`/painel/cardapio/produtos/[id]`** (`id='novo'` cria): nome, descrição, preço (input reais → inteiros via split ','), categoria, sort, ativo, foto WebP ≤1MB, adicionais do produto + globais marcados.
6. **`/painel/configuracoes`** — abas:
   - **Loja**: nome, logo, descrição, WhatsApp (só dígitos), `pix_key`, logo upload
   - **Horários**: editor 7 dias, ≤3 faixas/dia, final > inicial (trigger valida)
   - **Entrega**: bairros + taxas (add/rem/ativar), `min_order_cents`, `prep_time_min/max`; aviso "0 bairros ⇒ pickup-only".

**Admin (3 rotas):** `/admin` → `/admin/lojas` (lista + nova loja) → `/admin/lojas/[id]` (dados, toggle active, reset senha, **anonimizar pedido**).

**Vitrine pública:** busca client-side por nome/descrição (acents-insensitive, case-insensitive); 12 itens/categoria + "Ver mais"; teto 200 produtos/loja; busca client-side YAGNI.

---

## 9. Tratamento de Erros

| Caso | Comportamento |
|---|---|
| Falha checkout | Mensagem PT-BR; carrinho preservado |
| Preço mudou | Diff antes/depois; cliente confirma; nunca grava preço velho |
| Item indisponível | 422 com **nome do produto** ("Calabresa G saiu do cardápio") |
| Loja desativada | 404 público; painel "desativada pelo operador" |
| Loja sem bairros | Esconde "Entrega"; checkout entrega → 422 `BAIRROS_NAO_CONFIGURADOS` |
| Loja fechada | 409 `STORE_CLOSED` + "Abrimos às HH:MM" |
| Dedup 60s | 409 `DUPLICATE` sem token; "Já temos um pedido seu..." + wa.me |
| Rate limit | 429 `RATE_LIMIT` PT-BR |
| Realtime caiu | Indicador "Reconectando" + polling 30s |
| `orders` fora da publicação | Erro de migração — CI falha se `pg_publication_tables` não contiver `orders` |
| Colisão `code` | Retry até 6x, depois 500 |
| Foto > 1MB ou >1200px largura | Redimensiona p/ largura máx 1200px e comprime WebP; rejeita **somente se > 1MB após compressão** (emenda v3.1 #8) |
| Troco inválido (cash e change_for < total) | 400 `TROCO_INSUFICIENTE` |
| Código diário exaustivo (impraticável) | 500 após 6 tentativas (cenário quase impossível) |

---

## 10. Testes

- **Vitest (unit):** `pricing.ts` (subtotal, addons, taxa, mínimo sobre subtotal, troco, arredondamento), `store-hours.ts` (faixas, final inclusivo, meia-noite rejeitada, `force_closed`), `order-status.ts` (inclui `confirmed→preparing`), `cart.ts`, `code.ts` (4 chars, alfabeto, unicidade diária), `wa.ts`, `image.ts` (funções puras).
- **`tests/rls.sql` (9 asserções reais):**
  1. Anon não lê orders
  2. Anon não insere order (exceção esperada, `raise` **fora** do sub-bloco)
  3. Lojista A não lê/escreve pedido da B (Review Focus 2)
  4. Lojista não altera `total_cents` (column grant)
  5. Transição inválida bloqueada
  6. Transição válida grava `order_events` com `actor='store'`
  7. Lojista não altera `active` nem `slug` (slug imutável)
  8. Produto não aponta `category_id` de outra loja (FK composta)
  9. `orders` em `pg_publication_tables` (Realtime)
  - Metodologia: `BEGIN` explícito, `set local role` dentro da transação, `claims` via `\set`, `raise 'FALHA'` **fora** do `exception when others`, `ROLLBACK` final.
- **`tests/orders-api.test.ts` (13 casos):** total adulterado ignorado; `price_changed`; dedup 409 sem token; rate limit 429; item indisponível → 422 com nome; `force_closed` 409; bairro não configurado 422; honeypot 400; abaixo do mínimo 422; pix sem troco; `promised_at`/`ip_hash` gravados; CEP obrigatório 422; CEP 8 dígitos.
- **Playwright (3 cenários):** happy path + cancelamento cliente + rate limit; desktop + mobile (390×844).
- Sem coverage gate, sem snapshot visual v1.

---

## 11. Números Finais (sem "vago")

| Item | Valor |
|---|---|
| `code` do pedido | 4 chars, alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 6 tentativas, único por loja por dia (America/Manaus) |
| "Vermelho" no card | 10 min em `new` |
| Faixas por dia | máx 3 |
| `notes` pedido / item | 300 / 200 chars |
| `qty` / linhas | 20 / 30 (máx 30 linhas por pedido) |
| Retry `code` | 6 |
| Dedup | 60s → 409 sem token |
| Rate limit | 5 pedidos/hora/IP/loja (contagem de pedidos criados com sucesso) |
| LGPD retenção | anonimizar > 90 dias |
| Vitrine | 12 itens/categoria initially, "Ver mais"; teto 200 produtos/loja |
| Critério de sucesso | **binário**: 1 loja, 1 dia, ≥30 pedidos, 30 entregues, 0 erro checkout, 0 falha RLS |
| Corte antes de fechar | **nenhum** (aceita até o minuto final); `force_closed` é a ferramenta |
| `order_items` `qty` | 1..20 |
| `notes` lengths | pedido 300 / item 200 |
| Produtos ativos máx por loja | 200 |
| Prometida de entrega | `now() + interval '1 minute' * ceil((prep_time_min + prep_time_max) / 2)` |
| IP hash salt rotation | diário em 00:00 America/Manaus (tabela `daily_salt`) |
| Som do painel | toque curto (≤150ms) após interação do usuário no painel (ex.: novo pedido) — requer gesto inicial para desbloquear autoplay |
| Favicon badge | gerado via canvas, número sobre fundo vermelho, atualizado a cada mudança de estado |
| Formato de erro API | `{ error: { code: string, message: string } }` |
| Código de erro exemplos | `STORE_CLOSED`, `DUPLICATE`, `RATE_LIMIT`, `BAIRROS_NAO_CONFIGURADOS`, `TROCO_INSUFICIENTE`, `PRICE_CHANGED`, `STORE_NOT_CONFIGURED` (emenda v3.1 #9) |
| WebP qualidade | faixa 80-100, largura máxima 1200px |
| Logo upload bucket | `store-assets/logos/{store_id}/logo.webp` (emenda v3.1 #4) |
| Foto produto bucket | `store-assets/products/{store_id}/{product_id}.webp` |
| Horário de loja fuso | `America/Manaus` (para open_hours e kanban "hoje") |

---

## 12. Changelog (v2 → v3)

- Definição explícita da tabela `profiles` e vínculo com `auth.users`.
- Transação do checkout implementada via RPC `create_order` (security definer).
- Rate limit conta pedidos criados com sucesso usando `ip_hash` (sha256 IP + salt diário armazenado em tabela `daily_salt`).
- `promised_at` calculado como média arredondada para cima de `prep_time_min` e `prep_time_max`.
- Código do pedido agora **único por loja por dia** (data em America/Manaus) — evita exaustão infinita.
- Senha provisória do lojista gerada via Supabase Auth Admin API (fora de escopo v1, mas mecanismo descrito).
- Cancelamento automático do sistema para pedidos `new` > 24h.
- Validação de troco obrigatória para pagamento em dinheiro.
- Detalhamento de storage de imagens (bucket `store-assets`, pastas, limites de WebP).
- Mecanismo de WebP client-side (canvas, redimensionamento, qualidade).
- Som do painel: toque curto após interação inicial do usuário para contornar bloqueio de autoplay.
- Badge favicon gerado via canvas.
- Formato padronizado de erro da API: `{ error: { code, message } }`.
- Fluxo `price_changed` agora devolve detalhes de valores original e corrigido; confirmação via `confirmedPriceDiff=true`.
- Busca client-side normalizada: acents-insensitive e case-insensitive.
- Janela "não finalizados + hoje" usa fuso `America/Manaus`.
- Tracking endpoint mascara telefone (mostra apenas últimos 2 dígitos) e endereço (mostra apenas bairro); nome e notas permanecem visíveis (necessários para cliente).
- Column grant mantida como rede de segurança alongside RPC única via.
- Ordenação de categorias/produtos via drag-and-drop.
- Layout do cupom 80mm definido: cabeçalho com logo e nome da loja, código grande, lista de itens, total, rodapé.
- Admin pode listar pedidos da loja para escolher qual anonimizar.
- Guards de rota: `requireStore` redireciona para painel se lojista; senão, para `/admin`; loja inativa mostra mensagem "desativada pelo operador".
- Tempo de preparo usado no cálculo de `promised_at`.
- Mensagem padrão do wa.me no tracking (cliente → loja): "Novo pedido #CODIGO. Link: [URL de tracking]" (emenda v3.1 #11).
- Vitrine fora de horário: carrinho mantido, checkout desabilitado.
- Meta tags SEO: og:title = nome da loja, og:description = descrição, og:image = logo_url.
- Env vars necessárias listadas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_SALT_ROTATION_ENABLED` (opcional).
- Tooling de migrações: Supabase CLI gerenciada via migrations supabase.
- Honeypot campo: `website` (input tipo texto oculto).
- Mensagens PT-BR dos erros definidas na seção 9.
- Shape do campo `addons` jsonb: array de objetos `{name:string, price_cents:int}`.
- Limite rígido de 30 linhas de itens por pedido via trigger.
- Limite rígido de 200 produtos ativos por loja via trigger.
- Paginação da lista de lojas no admin: 50 por página.

---

## 13. Variáveis de Ambiente (env)

| Nome | Exemplo | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xyz.supabase.co` | URL pública do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon-key...` | Key anonima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `service-role-key...` | Key de serviço do Supabase (server-side only) |
| `DAILY_SALT_ROTATION_ENABLED` | `true` | Se verdadeiro, um cron (ex.: Vercel Cron) atualiza `daily_salt` todo dia às 00:00 America/Manaus |
| `NEXT_PUBLIC_APP_NAME` | `Kero` | Nome da aplicação (para títulos, etc.) |

---

**Fim da SPEC v3.** Único documento. Próxima fase: planejamento → execução a partir deste documento.

---

## 14. Emendas pós-auditoria (v3.1)

Decisões do supervisor após auditoria de ambiguidades (out/2026). Em conflito com o corpo do documento, **esta seção vence**.

1. **Fuso:** `America/Manaus` em tudo (substitui `America/Sao_Paulo` globalmente — SPEC, DS, migrations 001/002).
2. **Cancelamento:** `POST /api/orders/track/[token]` (mesma rota do GET). A rota `/cancel` não existe.
3. **Route groups:** painel vive em `app/(dash)/painel/`, cupom em `app/(print)/painel/pedidos/[id]/print/`, vitrine em `app/(public)/[slug]/`.
4. **Bucket `store-assets` canônico:** `logos/{store_id}/logo.webp` e `products/{store_id}/{product_id}.webp` (bate com a policy da migration 004, que exige `foldername[2] = store_id`).
5. **Alfabeto do código:** "sem I/L/O/0/1" (31 chars) — o alfabeto em si nunca mudou; a descrição da §4 estava errada.
6. **Login:** rota `app/login/page.tsx` + `login-client.tsx` existe (exceção documentada à árvore da §4).
7. **CEP obrigatório somente em entrega** (`type='delivery'`), nunca em retirada.
8. **Imagem client-side:** redimensiona para largura máx 1200px e comprime WebP; rejeita **apenas se > 1MB após compressão** (resolve §3.1 × §9).
9. **Gate de ativação:** `active=true` exige `prep_time_min/max` preenchidos — trigger `fn_protect_store_columns` (002) levanta `STORE_NOT_CONFIGURED`. Código adicionado à lista da §11; copy no DS §8.4.
10. **Cupom 80mm:** imprime a URL real de tracking `kero.app/{slug}/pedido/{tracking_token}` (não link curto — UUID é inviável pra digitar, mas link curto não existe).
11. **wa.me no tracking:** botão do cliente para a loja: "Olá! Sobre meu pedido #CODIGO" (typo "Nouvo" corrigido na §12).
12. **Signup público desligado:** `enable_signup = false` em `config.toml`; lojista v1 nasce via Auth Admin API (§2.28). Trigger `fn_on_signup` (005) cria o profile.
13. **Horários:** o seed é a referência — 11:00–23:00 todos os dias. Vitrine e Configurações herdam do banco quando ligar (hoje ambas exibem valores mock divergentes; marcados como demo).
14. **`cancellation_reason`:** visível no painel (timeline do detalhe) e no tracking do cliente (quando cancelado, mostra motivo).
15. **`requireStore` com `store_id` null** (lojista órfão): trata como não autenticado → redireciona para `/login`.
16. **Chip de taxa da vitrine:** mostra "Entrega a partir de R$ X" com a menor taxa de bairro ativo; se a loja não tem bairros (só retirada), o chip não aparece. O campo `delivery_fee_cents` do mock não existe no banco — é só demo.
17. **`address.reference`:** removido do jsonb da §5 — o checkout não coleta ponto de referência no v1.
18. **`create_order`:** a intenção/contrato de negócio vive nesta SPEC (§5/§6); a assinatura SQL real vive na migration 002 (o banco é soberano sobre a assinatura — a SPEC tinha divergido). `pricing.ts` é fonte única de totais **no front** (preview); no server o recálculo autoritativo é o do RPC (PL/pgSQL). Fluxo `PRICE_CHANGED`: o front recomputa via `pricing.ts` e reenvia com `confirmedPriceDiff=true`.
19. **Auto-cancel 24h:** o cron `POST /api/cron/daily-salt` (API-05) chama `get_daily_salt()` e `auto_cancel_stale_orders()` na sequência.