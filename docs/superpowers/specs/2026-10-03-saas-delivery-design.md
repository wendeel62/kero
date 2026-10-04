# Kero — SaaS Delivery White-Label (SPEC v2)

**Fonte de verdade absoluta. Único documento. Substitui v1 + emendas + plano.**

---

## 1. Propósito

Plataforma SaaS white-label por restaurante: cada loja tem vitrine própria (`kero.app/pizza-do-joao`), cardápio, pedidos e painel. **Não é marketplace.**

**Usuários:**
1. **Cliente final** — pede na vitrine, sem login.
2. **Lojista** — gerencia cardápio e pedidos no painel autenticado.
3. **Operador** — cria/desativa lojas via admin.

**Critério de sucesso (binário):** 1 loja real opera 1 dia inteiro de delivery — ≥30 pedidos aceitos, 30 entregues, 0 erro de checkout, 0 falha no teste de RLS.

---

## 2. Decisões Travadas (25)

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
| 10 | Totais | Recalculados no servidor; client é só exibição |
| 11 | Cliente final | **Sem login** — acompanhamento por link com `tracking_token` uuid |
| 12 | Tamanhos de pizza | Produtos separados ("Margherita G/M"); adicionais usam `product_addons` |
| 13 | Fuso | Grava UTC; exibe `America/Sao_Paulo` |
| 14 | Idioma | PT-BR em toda UI |
| 15 | Loja aberta | `active AND NOT force_closed AND dentro do open_hours(zone America/Sao_Paulo)` |
| 16 | Canal de aviso | **Painel aberto é requisito** (sem push/e-mail/SMS v1) — risco nº 1 |
| 17 | Loja inativa | **404** para o público (não vaza existência) |
| 18 | Pedido duplicado | Mesmo telefone+loja < 60s → **409 sem devolver token** (link wa.me) |
| 19 | Horário meia-noite | **Proibido v1** — faixa final deve ser > inicial; máx 3 faixas/dia |
| 20 | Pedido mínimo | Compara com **subtotal** (antes da taxa); vale para entrega e retirada |
| 21 | Cancelamento cliente | `new`/`confirmed` pode cancelar com motivo (`canceled_by='customer'`) |
| 22 | Rate limit | **5 pedidos/hora/IP/loja** via `ip_hash` (sha256 IP + salt diário) |
| 23 | LGPD | Anonimiza nome, telefone, endereço **e notas**; `anonymized_at`; retenção > 90 dias |
| 24 | Impressão | **Bobina 80mm** padrão (`@page { size: 80mm auto }`); A4 só relatório |
| 25 | Estoque | `active` = interruptor definitivo; estoque limitado fora de escopo |

---

## 3. Escopo

### 3.1 Dentro (v1)

- Vitrine pública por loja: cardápio por categorias, busca client-side, 12 itens/categoria + "Ver mais", teto 200 produtos/loja
- Checkout: nome, WhatsApp, entrega/retirada, endereço + bairro (select ativos), forma de pagamento, troco, observações, **CEP obrigatório**
- Pedido mínimo validado no servidor
- Horário de funcionamento: fora do horário → banner + checkout desabilitado
- **Painel lojista** (Supabase Auth):
  - Kanban: `new → confirmed → preparing → ready/out → delivered` (+ `cancelled` colapsado)
  - Janela: **não finalizados + hoje**; contador real de cancelados de hoje
  - Alertas: som + toast + badge "N aguardando ação" + contador no título/favicon da aba
  - CRUD categorias, produtos (foto WebP ≤1MB, preço, descrição, disponibilidade), adicionais (por produto/globais)
  - CRUD bairros + taxas; pedido mínimo; tempo de preparo
  - Configurações: dados, logo, WhatsApp, `pix_key`, horários, bairros
- **Admin operador**: criar loja (slug + dono + senha provisória), ativar/desativar, reset senha, **anonimizar pedido**
- Anti-abuso: honeypot + dedup 60s (409 sem token) + rate limit 5/h/IP/loja
- Fotos: WebP client-side ≤1MB antes do upload
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
├── (painel)/painel/
│   ├── page.tsx                     Hoje (resumo + toggle force_closed)
│   ├── pedidos/page.tsx             kanban (não finalizados + hoje)
│   ├── pedidos/[id]/page.tsx        detalhe + ações
│   ├── pedidos/[id]/print/page.tsx  cupom 80mm
│   ├── cardapio/page.tsx            categorias + produtos + adicionais globais
│   ├── cardapio/produtos/[id]/page.tsx  form produto + adicionais
│   └── configuracoes/page.tsx       abas: Loja | Horários | Entrega
├── (admin)/admin/
│   ├── page.tsx                     → /admin/lojas
│   ├── lojas/page.tsx               lista + criar loja
│   └── lojas/[id]/page.tsx          detalhe + toggle active + reset senha + anonimizar
└── api/
    ├── orders/route.ts              POST checkout (service role)
    ├── orders/[id]/status/route.ts  PATCH status (set_order_status RPC)
    ├── orders/track/[token]/route.ts  GET acompanhamento (service role)
    └── admin/orders/[id]/anonymize/route.ts  LGPD anonimização

lib/
├── pricing.ts      ÚNICA fonte de totais (centavos int, server + client)
├── order-status.ts Máquina de estados (canTransition, nextStatus, rótulos PT-BR)
├── store-hours.ts  isStoreOpen / nextOpeningLabel (TZ America/Sao_Paulo)
├── cart.ts         Operações puras do carrinho
├── code.ts         Código curto 4 chars (alfabeto sem I/O/0/1)
├── wa.ts           Links wa.me (normaliza dígitos, 55 default)
├── image.ts        WebP ≤1MB client-side (pickQuality, shouldRejectType puros)
├── queries.ts      Leituras da vitrine (via RLS)
├── auth.ts         requireStore / requireAdmin
└── supabase/       client.ts | server.ts | admin.ts (service role — SÓ server-side)
```

**Rotas server-side (service role):**
1. `POST /api/orders` — checkout (validações, recalc, rate limit, dedup, transação)
2. `PATCH /api/orders/[id]/status` — `set_order_status` RPC (`actor='store'`)
3. `POST /api/orders/track/[token]/cancel` — `set_order_status(..., 'customer')`
4. `GET /api/orders/track/[token]` — tracking público (mascarado, `promised_at`, `canCancel`)
5. Admin: stores CRUD + anonimização

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

create table categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null, sort_order integer not null default 0,
  active boolean not null default true,
  unique (id, store_id)
);

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

create table neighborhoods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null,
  fee_cents integer not null default 0 check (fee_cents >= 0),
  active boolean not null default true,
  unique (store_id, name)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  code text not null check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$'),
  tracking_token uuid not null unique default gen_random_uuid(),
  customer_name text not null check (length(customer_name) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,15}$'),
  type text not null check (type in ('delivery','pickup')),
  address jsonb,          -- entrega: { street, number, complement, reference, cep, neighborhood_id, neighborhood_name }
                          --   cep obrigatório (8 dígitos); bairro + nome = snapshot
                          -- retirada: null
  payment_method text not null check (payment_method in ('cash','pix','card_machine')),
  change_for_cents integer,
  pix_key text,
  notes text check (notes is null or length(notes) <= 300),
  subtotal_cents integer not null,
  delivery_fee_cents integer not null default 0,
  total_cents integer not null,
  promised_at timestamptz,
  status text not null default 'new'
    check (status in ('new','confirmed','preparing','ready','out','delivered','cancelled')),
  cancellation_reason text,
  canceled_by text check (canceled_by in ('store','customer','system')),
  anonymized_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  name_snapshot text not null,
  unit_price_cents integer not null,
  qty integer not null check (qty between 1 and 20),
  addons jsonb not null default '[]'::jsonb,
  notes text check (notes is null or length(notes) <= 200)
  -- sem product_id: "pedir de novo" fora de escopo
);

create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  from_status text, to_status text not null,
  actor text not null default 'store' check (actor in ('store','customer','system')),
  created_at timestamptz not null default now()
);

-- Índices
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
```

---

## 6. Auth & RLS

- **Lojista/staff**: Supabase Auth email/senha → `profiles.store_id` define a loja
- **Operador**: `profiles.role='admin'`
- **Cliente final**: anônimo

**Helper:** `auth_store_id()` → `store_id` do profile autenticado. Todas policies usam isso.

| Tabela | Anon | Lojista | Admin |
|---|---|---|---|
| stores, categories, products, addons, neighborhoods | SELECT `active=true` | ALL próprio `store_id` | service role |
| orders, order_items, order_events | **nada** (público só via `/api/orders/track/[token]`) | SELECT próprio `store_id`; UPDATE só colunas permitidas | service role |
| profiles | nada | SELECT própria linha | service role |

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

**Máquina de estados:**
```
new → confirmed → preparing → ready      (retirada) → delivered
                        ↘ out        (entrega)  ↗
qualquer (exceto delivered) → cancelled   (loja ou cliente)
delivered = final
```

**Uma verdade só:** UI transiciona via rota server-side → RPC `set_order_status`; trigger é a garantia final.

---

## 7. Fluxo do Pedido

1. Cliente abre vitrine → SSR cardápio. `active=false` → 404. Fora de `open_hours` → banner + checkout desabilitado.
2. Monta carrinho (localStorage) → checkout: nome, WhatsApp, entrega/retirada, endereço + bairro (select), pagamento, troco, obs.
3. `POST /api/orders` (service role) — ordem:
   a) honeypot vazio
   b) **rate limit 5/h/IP/loja** (429)
   c) dedup 60s → **409 sem token**, mensagem + wa.me
   d) loja `active` e aberta (409)
   e) bairro ativo ou **pickup-only** (0 bairros = pickup-only)
   f) **recalcula tudo** via `pricing.ts` (ignora total do cliente)
   g) divergência → `price_changed` → cliente confirma → reenvia `confirmedPriceDiff`
   h) `create_order` grava orders + order_items + `order_events('new', actor='customer')` numa transação, com `promised_at` e `ip_hash`
   i) responde `tracking_token` **apenas do pedido recém-criado**
4. Cliente → `/[slug]/pedido/[token]`: status, `promised_at` ("chega ~19:40"), timeline (com `actor`), itens, total, botão wa.me, **botão "Cancelar" em `new`/`confirmed`**.
5. Painel: Realtime → toast + som + badge "aguardando ação" → `confirmed → preparing → ready|out → delivered`. Badge na aba em background.
6. Cancelamento exige motivo ≥3 chars + `canceled_by`. `delivered` = final. Cliente cancela só em `new`/`confirmed` (via `set_order_status(..., 'customer')`).

---

## 8. Telas (painel — 6 telas, sidebar fixa)

1. **`/painel` — Hoje**: cards (Pedidos hoje, Faturamento hoje exclui cancelados, Ticket médio, Aguardando ação badge), últimos 5 pedidos, toggle **Fechar agora** (`force_closed` + `force_closed_at`), banner "Fechada desde HH:MM" + "Reabrir".
2. **`/painel/pedidos` — Kanban**: janela **não finalizados + hoje**; colunas `new → confirmed → preparing → ready/out → delivered`; "Cancelados (hoje)" colapsada com contador real; card: código 4 chars, nome, tempo decorrido (vermelho após 10 min em `new`), "Aguardando X min" em `new`, `formatBRL`, badges entrega/retirada/pagamento; botão "Avançar" (`nextStatus` incl. `confirmed→preparing`), "Cancelar" (diálogo motivo ≥3).
3. **`/painel/pedidos/[id]` — Detalhe**: cliente (nome + wa.me), itens snapshot + addons + obs, endereço/retirada, pagamento + troco, timeline (`order_events` com `STATUS_LABEL` + `actor`), ações: avançar, cancelar, **imprimir 80mm**.
4. **`/painel/cardapio`**: categorias ordenáveis; cards produto (foto, nome, preço, toggle disponível); botões nova categoria / novo produto; tabela adicionais globais.
5. **`/painel/cardapio/produtos/[id]`** (`id='novo'` cria): nome, descrição, preço (input reais → inteiros via split ','), categoria, sort, ativo, foto WebP ≤1MB, adicionais do produto + globais marcados.
6. **`/painel/configuracoes`** — abas:
   - **Loja**: nome, logo, descrição, WhatsApp (só dígitos), `pix_key`, logo upload
   - **Horários**: editor 7 dias, ≤3 faixas/dia, final > inicial (trigger valida)
   - **Entrega**: bairros + taxas (add/rem/ativar), `min_order_cents`, `prep_time_min/max`; aviso "0 bairros ⇒ pickup-only".

**Admin (3 rotas):** `/admin` → `/admin/lojas` (lista + nova loja) → `/admin/lojas/[id]` (dados, toggle active, reset senha, **anonimizar pedido**).

**Vitrine pública:** busca client-side por nome/descrição; 12 itens/categoria + "Ver mais"; teto 200 produtos/loja; busca client-side YAGNI.

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
| Foto > 1MB | Compressão WebP; se exceder, rejeita |

---

## 10. Testes

- **Vitest (unit):** `pricing.ts` (subtotal, addons, taxa, mínimo sobre subtotal, troco, arredondamento), `store-hours.ts` (faixas, final inclusivo, meia-noite rejeitada, `force_closed`), `order-status.ts` (inclui `confirmed→preparing`), `cart.ts`, `code.ts` (4 chars, alfabeto, unicidade), `wa.ts`, `image.ts` (funções puras).
- **`tests/rls.sql` (9 asserções reais — teste anterior era falso-verde):**
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
| `code` do pedido | 4 chars, alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 6 tentativas |
| "Vermelho" no card | 10 min em `new` |
| Faixas por dia | máx 3 |
| `notes` pedido / item | 300 / 200 chars |
| `qty` / linhas | 20 / 30 |
| Retry `code` | 6 |
| Dedup | 60s → 409 sem token |
| Rate limit | 5 pedidos/hora/IP/loja |
| LGPD retenção | anonimizar > 90 dias |
| Vitrine | 12 itens/categoria initially, "Ver mais"; teto 200 produtos/loja |
| Critério de sucesso | **binário**: 1 loja, 1 dia, ≥30 pedidos, 30 entregues, 0 erro checkout, 0 falha RLS |
| Corte antes de fechar | **nenhum** (aceita até o minuto final); `force_closed` é a ferramenta |
| `order_items` `qty` | 1..20 |
| `notes` lengths | pedido 300 / item 200 |

---

## 12. Changelog (v1 → v2)

- Dedup → 409 sem devolver token (evita vazamento de pedido alheio)
- Rate limit 5/h/IP/loja via `ip_hash` (telefone variável burlava dedup)
- `cep` obrigatório no endereço (P0: entregador não acha casa sem CEP)
- `promised_at` + `pix_key` no pedido
- `force_closed_at` + banner "Fechada desde HH:MM" (sem auto-reset)
- `canceled_by` + cancelamento pelo cliente em `new`/`confirmed`
- Rate limit real por IP (sha256 IP + salt diário)
- LGPD anonimiza **notas** também (LGPD real)
- `force_closed` sem auto-reset, banner persistente
- `open_hours` proíbe faixa que atravessa meia-noite; máx 3 faixas
- Mínimo compara com subtotal; vale entrega+retirada
- Cliente cancela em `new`/`confirmed` (`canceled_by='customer'`)
- `orders` na publicação `supabase_realtime`
- Column grants no `orders` (RLS não filtra coluna)
- `unique (id, store_id)` + FKs compostas (integridade intra-loja)
- `orders` pickup-only se 0 bairros ativos
- Impressão: bobina 80mm padrão
- Vitrine: busca client-side + "Ver mais" 12/categoria, teto 200
- Teste RLS reescrito (9 asserções reais, sem falso-verde)
- Números vagos → todos definidos

---

**Fim da SPEC v2.** Único documento. Plano apagado. Próxima fase: planejamento → execução a partir deste documento.