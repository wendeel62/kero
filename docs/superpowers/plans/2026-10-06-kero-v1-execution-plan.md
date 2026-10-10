# Kero — Plano de Execução v1 (Esteira Etapa 3)

> **Ordnem e escopo de execução.** Este plano diz **em que ordem**, **o que exatamente**
> e **o que NÃO fazer**. As regras de negócio vêm da SPEC; o visual vem do Design System.
> Nenhuma das três fontes é opcionais.
>
> - SPEC (fonte de verdade absoluta): `docs/superpowers/specs/2026-10-04-saas-delivery-design-v3.md`
> - Design System (fonte de verdade visual): `docs/design-system.md`
> - Escrito para ser lido e executado por **IA**, com **supervisão humana** por checkpoint.

---

## 0. Regras para a IA executora (anti-fuga — ler primeiro)

1. **Ordem de leitura obrigatória**: SPEC v3 → Design System → este plano → task atual.
   Nunca começar uma task sem ter lido as seções da SPEC/DS que ela referencia.
2. **Listas fechadas**: só existe o que está na **Lista de arquivos (§5.1)** e na
   **Lista de dependências (§5.2)** deste plano. Criar qualquer arquivo/pasta/dep fora
   delas = violação do plano.
3. **Componentes visuais**: só os 13 do catálogo DS §4. Proibido instalar shadcn CLI,
   framer-motion ou qualquer lib de UI/animação — o catálogo já define tudo em Tailwind puro.
4. **Escopo fora (SPEC §3.2) é proibição absoluta**: gateway, billing, push, e-mail/SMS,
   login de cliente, cupons, fidelidade, relatórios, multi-usuário com convite, estoque
   limitado, pedido agendado, NFC-e, gorjeta, "pedir de novo". **Nada disso entra, nem
   "para o futuro".**
5. **SPEC e DS são imutáveis durante a execução.** Se a IA perceber que um dos dois está
   errado ou incompleto → **Protocolo de exceção (§7)**: PARAR e reportar ao supervisor.
   Nunca "consertar" a spec por conta própria.
6. **Antes de criar, subir a escada (AGENTS.md / modo lazy)**: já existe no código?
   A stdlib resolve? A plataforma (Next/Supabase/Tailwind) já tem nativo? Só então
   escrever o mínimo que funciona.
7. **Definition of Done é binário.** Task só está pronta quando o DoD dela é verdadeiro
   e verificável. Sem "quase pronto".
8. **Checkpoint de supervisão** ao fim de cada milestone: a IA apresenta resumo do diff +
   resultado dos testes e **aguarda aprovação do supervisor** antes do próximo milestone.
9. **Invariantes globais** (vale em toda linha de código): dinheiro em centavos `integer`
   (nunca float); PT-BR em toda UI; fuso de exibição `America/Manaus` (SPEC §2.13);
   erro de API sempre `{ error: { code, message } }` (SPEC §11); UI nunca calcula preço
   final — só o servidor (SPEC §2.10).
10. **Commits pequenos**: um commit (ou mais) por task, mensagem referenciando o ID
    (`DB-02: schema inicial`).

### 0.1 Relação com a esteira de 6 etapas

| Etapa da esteira | O que é na prática |
|---|---|
| 1. SPEC ✅ | Feita |
| 2. Design System ✅ | Feito |
| **3. PLANO (este arquivo)** | Ordem + escopo + guardrails |
| 4. Backlog/Tasks | Opcional — os IDs/tarefas de §6 já são o backlog; só extrair p/ board se o supervisor quiser |
| 5. Scaffold + Schema | = executar **M1** (e o scaffold inicial de M2) |
| 6. Implementação | = executar **M2 → M8** na ordem |

---

## 1. Objetivo e critério de sucesso

Da SPEC §1, sem alteração:

> 1 loja real opera 1 dia inteiro de delivery — ≥30 pedidos aceitos, 30 entregues,
> 0 erro de checkout, 0 falha no teste de RLS.

Critério **binário**. O projeto só está pronto quando isso for verdade.

---

## 2. Mapa dos milestones e grafo de dependências

```
M1 Infra/DB ──► M2 Auth ──► M3 API Core ──┬──► M4 Vitrine ──► M7 Realtime+UX ──► M8 Testes/CI
                                          └──► M5 Painel ────┘        (M7 puxa de M4+M5)
                                               M6 Admin (após M2; ∥ M5)
```

| Milestone | Entrega | Depende de |
|---|---|---|
| **M1** Infra/DB | Supabase + schema + RLS + Realtime + buckets + seed demo | — |
| **M2** Auth & guards | Login + sessão + `requireStore`/`requireAdmin` + `/login` | M1 |
| **M3** API Core | Rotas `/api/*` com contratos da SPEC | M2 |
| **M4** Vitrine | `[slug]` completo lendo do DB | M3 |
| **M5** Painel | 8 telas do lojista | M3 (M2 já feito) |
| **M6** Admin | Lista + criar loja + anonimizar | M2, M3 |
| **M7** Realtime+UX | Kanban ao vivo + som + favicon badge + fallback | M4, M5 |
| **M8** Testes/CI | Vitest + RLS.sql + API + Playwright + CI verde | todos |

M5 e M6 podem rodar em paralelo após M3. M4 antes de M5 (o painel reusa padrões da vitrine).

---

## 3. Convenções globais (vale para todas as tasks)

- **Stack**: Next.js 15 App Router + React 19 + TS + Tailwind v4 (`@import "tailwindcss"`)
  + Supabase (Postgres/Auth/Storage/Realtime) + Vercel. Exatamente isso.
- **Estrutura de pastas**: a árvore da SPEC §4 é o mapa final. Nenhuma pasta extra além
  da Lista de arquivos (§5.1).
- **lib/ é compartilhado**: `pricing.ts` é a ÚNICA fonte de totais (SPEC §2.10);
  `order-status.ts` a ÚNICA máquina de estados; `store-hours.ts` a ÚNICA fonte de
  "loja aberta"/"hoje" (TZ `America/Manaus`).
- **Design**: tokens DS §2 (+2.1 dark), motion DS §3 (CSS puro, sem libs, sempre
  `prefers-reduced-motion`), componentes DS §4 (1–13), anti-patterns DS §7.
- **A11y é obrigatório** (DS §3.1): `aria-live` em região que muda sozinha, `role="status"`
  no contador da sacola, `focus-visible` em todo focável, `<label htmlFor>` em todo input,
  `aria-label` em botão só-ícone, contraste AA.
- **Server/Client**: página = server component (SSR); interação = client component
  (`*-client.tsx`), padrão já usado no DS §1.
- **SQL**: migrations em `supabase/migrations/`, numeradas `001_…`, `002_…`; aplicar com
  `supabase db push`. SQL literal da SPEC §5/§6 é a base — não "melhorar" além dela.

---

## 4. Listas fechadas (anti-invenção)

### 4.1 Lista de arquivos a criar (COMPLETA — nada fora dela)

```
supabase/
├── config.toml                          (DB-01)
├── migrations/
│   ├── 001_schema.sql                   (DB-02 — tabelas+índices da SPEC §5)
│   ├── 002_functions_triggers.sql       (DB-03 — funções/triggers da SPEC §6)
│   ├── 003_rls.sql                      (DB-04 — policies+grants da SPEC §6)
│   ├── 004_realtime_storage.sql         (DB-05 — publication+buckets+policies)
│   └── 005_profiles_trigger.sql         (AUTH-04 — trigger fn_on_signup; v3.1)
└── seed.sql                             (DB-06 — loja demo a partir de menu-data)

app/
├── layout.tsx                           (WEB-00 — já no scaffold; html pt-BR, metadata)
├── globals.css                          (WEB-00 — tokens DS §2/2.1 + motion §3)
├── login/page.tsx + login-client.tsx    (AUTH-03 — infra mínima, ver nota)
├── page.tsx                             (WEB-01 — redirect p/ loja demo, DS §5)
├── [slug]/
│   ├── page.tsx + vitrine-client.tsx    (WEB-02 — vitrine, DS §8.1; nome real, v3.1)
│   ├── menu-data.ts                     (WEB-02 — vira seed/tipos; não importar em página prod.)
│   ├── produto/[id]/page.tsx + produto-client.tsx  (WEB-03 — DS §8.2)
│   ├── carrinho/page.tsx + carrinho-client.tsx     (WEB-04 — DS §8.3)
│   ├── checkout/page.tsx + checkout-client.tsx     (WEB-05 — DS §8.4)
│   └── pedido/[token]/page.tsx + pedido-client.tsx (WEB-06 — DS §8.5)
├── (dash)/painel/
│   ├── layout.tsx                       (AUTH-02/PAINEL-01 — trilho DS §8.6 + guard requireStore)
│   ├── mock.ts                          (PAINEL-01 — demo até dados reais; deletar no fim de M5)
│   ├── page.tsx                         (PAINEL-02 — Hoje, DS §8.6)
│   ├── pedidos/page.tsx                 (PAINEL-03 — Kanban, DS §8.7)
│   ├── pedidos/[id]/page.tsx            (PAINEL-04 — Detalhe, DS §8.8)
│   ├── cardapio/page.tsx                (PAINEL-06 — DS §8.10)
│   ├── cardapio/produtos/[id]/page.tsx  (PAINEL-07 — DS §8.11)
│   └── configuracoes/page.tsx           (PAINEL-08 — DS §8.12)
├── (print)/painel/pedidos/[id]/print/page.tsx  (PAINEL-05 — cupom 80mm, DS §8.9; fora da sidebar)
├── (admin)/admin/
│   ├── layout.tsx                       (ADMIN-01 — guard requireAdmin)
│   ├── page.tsx                         (ADMIN-01 — redirect p/ lista)
│   ├── lojas/page.tsx                   (ADMIN-02 — DS §8.13)
│   └── lojas/[id]/page.tsx              (ADMIN-03 — DS §8.13)
└── api/
    ├── orders/route.ts                  (API-01)
    ├── orders/[id]/status/route.ts      (API-02)
    ├── orders/track/[token]/route.ts    (API-03 — GET masked + POST cancel)
    ├── cron/daily-salt/route.ts         (API-05 — rotação do salt)
    └── admin/
        ├── stores/route.ts              (API-04 — CRUD lojas)
        └── orders/[id]/anonymize/route.ts (API-04 — LGPD)

lib/
├── pricing.ts        (M3 — totais em centavos; fonte única)
├── order-status.ts   (M3 — máquina de estados + STATUS_LABEL PT-BR)
├── store-hours.ts    (M3 — isStoreOpen/nextOpeningLabel, TZ America/Manaus)
├── cart.ts           (M4 — sacola; já existe padrão no DS §1 item 31)
├── code.ts           (M3 — código 4 chars, alfabeto sem I/O/0/1)
├── wa.ts             (M4 — links wa.me)
├── image.ts          (M5 — WebP ≤1MB/1200px client-side)
├── queries.ts        (M4 — leituras da vitrine via RLS)
├── auth.ts           (M2 — requireStore/requireAdmin)
├── api-errors.ts     (M3 — formato { error: { code, message } })
└── supabase/
    ├── client.ts     (M2 — browser)
    ├── server.ts     (M2 — server component)
    └── admin.ts      (M2 — service role, server-side ONLY)

components/ui/
├── status-badge.tsx     (M3 — DS §4 item 11)
├── image-uploader.tsx   (M5 — DS §4 item 12)
├── price-input.tsx      (M5 — R$ → centavos int com prévia)
└── price-change-dialog.tsx (M4 — diff original×corrigido, DS §8.4)

tests/
├── rls.sql              (TEST-02 — 9 asserções, SPEC §10)
├── orders-api.test.ts   (TEST-03 — 13 casos, SPEC §10)
├── unit/*.test.ts       (TEST-01 — pricing, store-hours, order-status, cart, code, wa, image)
└── e2e/*.spec.ts        (TEST-04 — Playwright 3 cenários)

.github/workflows/ci.yml  (TEST-05)
.env.example              (DB-01 — vars da SPEC §13)
vercel.json               (API-05 — cron se usado)
```

> **Nota AUTH-03 (login)**: a SPEC §4 não lista rota de login, mas o lojista usa
> Supabase Auth email/senha (SPEC §6) — uma página mínima é **infra necessária, não
> invenção**. Escopo travado: form e-mail+senha, reusa tokens DS §2, zero design novo,
> redirect por role (`loja`→`/painel`, `admin`→`/admin`). Marcada aqui para o supervisor
> validar. [decisão deliberate — marcar com comentário `ponytail:` no código]

### 4.2 Lista de dependências (COMPLETA — nada fora dela)

```
next, react, react-dom
@supabase/supabase-js, @supabase/ssr
tailwindcss, @tailwindcss/postcss
typescript, @types/react, @types/node, @types/react-dom
vitest
@playwright/test
```

**Proibido**: shadcn CLI, framer-motion, lodash, date-fns/dayjs (usar `Intl` e `Date`),
zod (validações à mão conforme SPEC), axios (usar `fetch`), qualquer lib de UI/som
(som = `Audio`/Web Audio nativo; badge = canvas nativo).

---

## 5. Invariantes e contratos (memorizar antes de M3)

| Contrato | Valor exato | Fonte |
|---|---|---|
| Erro de API | `{ error: { code, message } }` | SPEC §11 |
| Códigos de erro | `STORE_CLOSED, DUPLICATE, RATE_LIMIT, BAIRROS_NAO_CONFIGURADOS, TROCO_INSUFICIENTE, PRICE_CHANGED` | SPEC §9/§11 |
| Dinheiro | centavos `integer` | SPEC §2.9 |
| Totais | servidor recalcula; client exibe | SPEC §2.10 |
| Fuso | grava UTC, exibe `America/Manaus` | SPEC §2.13 |
| Ordem de validação do checkout | honeypot → rate limit → dedup → loja ativa/aberta → bairro → recálculo → `price_changed` → `create_order` | SPEC §7.3 |
| Rate limit | 5 pedidos/hora/IP/loja (conta criados com sucesso) | SPEC §2.22 |
| Dedup | mesmo telefone+loja <60s → 409 sem token + wa.me | SPEC §2.18 |
| Código do pedido | 4 chars `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, único por loja/dia, retry 6x | SPEC §2.26/§11 |
| `promised_at` | `now() + ceil((prep_min+prep_max)/2) min` | SPEC §2.27 |
| Troco | `cash` → `change_for_cents >= total_cents`; senão `NULL` | SPEC §2.30 |
| Cancelar cliente | só `new`/`confirmed`, motivo ≥3 chars, `canceled_by='customer'` | SPEC §2.21 |
| Auto-cancel | `new` >24h → `canceled_by='system'`, motivo `timeout_24h` | SPEC §2.29 |
| Loja inativa | 404 público | SPEC §2.17 |
| Máquina de estados | `new→confirmed→preparing→(ready│out)→delivered`; qualquer (exceto delivered)→`cancelled` | SPEC §6 |
| Transição | só via `set_order_status` RPC; trigger é a garantia final | SPEC §6 |
| Realtime | `orders` na publication; painel filtra `store_id`; tracking = polling 15s | SPEC §4 |

---

## 6. Milestones detalhados

Formata de cada task: **ID · o que fazer · arquivos · DoD**. "Proibido" lista as tentações
específicas da task. Referências entre parênteses.

### M1 — Infra & DB

- **DB-01 · Scaffold Supabase + env**
  - `supabase init`, pasta `migrations/`, `.env.example` com as 5 vars da SPEC §13,
    `config.toml` padrão.
  - DoD: `supabase db push` roda sem migration e sem erro; `.env.example` completo.
- **DB-02 · Migration `001_schema.sql`**
  - SQL literal da SPEC §5: `stores, profiles, daily_salt, categories, products,
    product_addons, neighborhoods, orders, order_items, order_events` + todos os índices
    + `unique (store_id, code, dia America/Manaus)` + FKs compostas `(id, store_id)`.
  - DoD: push ok; `psql` lista as 10 tabelas e os índices da SPEC §5.
  - Proibido: inventar coluna nova, trocar tipo, remover check/constraint.
- **DB-03 · Migration `002_functions_triggers.sql`**
  - Funções/triggers da SPEC §6: `enforce_order_status_transition`,
    `protect_store_columns` (slug imutável, `active` só service_role),
    `validate_open_hours` (final>inicial, máx 3/dia), `set_order_status`,
    `create_order` (ordem de validação da SPEC §7.3, security definer),
    `fn_check_order_items_limit` (30 linhas), `trg_enforce_max_products_loja` (200),
    `get_daily_salt`, `calculate_ip_hash`, `promise_time`.
  - DoD: push ok; chamada manual de `set_order_status` grava evento com `actor`.
  - Proibido: lógica de negócio em TypeScript que pertence ao SQL (rate limit, dedup,
    recálculo — tudo dentro de `create_order`).
- **DB-04 · Migration `003_rls.sql`**
  - Policies da tabela da SPEC §6 (anon/lojista/admin) + `auth_store_id()` +
    column grants (`revoke update … ; grant update (status, cancellation_reason,
    canceled_by, updated_at) on orders to authenticated`).
  - DoD: push ok; anon não lê `orders` (query manual falha).
- **DB-05 · Migration `004_realtime_storage.sql`**
  - `alter publication supabase_realtime add table orders;` + bucket `store-assets`
    com pastas `logos/`, `products/` + policies de storage da SPEC §4.
  - DoD: `select * from pg_publication_tables` contém `orders`; bucket existe.
- **DB-06 · Seed da loja demo**
  - `seed.sql` convertendo `menu-data.ts` (loja demo + cardápio + bairros) em INSERTs.
  - DoD: `select` retorna loja demo ativa com ≥2 categorias e produtos.

### M2 — Auth & guards

- **AUTH-01 · Clientes Supabase**
  - `lib/supabase/{client,server,admin}.ts` (service role **só** em `admin.ts`, server-side).
  - DoD: import em server component funciona; `admin.ts` quebra se importado no browser.
- **AUTH-02 · Guards**
  - `lib/auth.ts`: `requireStore()` (profile `store_id`; sem sessão → redirect `/login`),
    `requireAdmin()` (`role='admin'`). `painel/layout.tsx` chama `requireStore()`,
    `admin/layout.tsx` chama `requireAdmin()` — **um ponto de guarda por área**, sem
    middleware extra.
  - DoD: sem login, `/painel` e `/admin` redirecionam; com login `loja`, `/admin` bloqueia.
- **AUTH-03 · Página `/login` (infra mínima)**
  - Form e-mail+senha, tokens DS §2, redirect por role. Ver nota em §4.1.
  - DoD: login com usuário de teste redireciona certo; erro mostra PT-BR.
- **AUTH-04 · Sincronia `profiles`**
  - Trigger `fn_on_signup` vive na migration **`005_profiles_trigger.sql`** (v3.1 — não editar a 002, já aplicada). Usuário de teste criado via Supabase Studio (signup público está `false` no `config.toml`).
  - DoD: usuário de teste tem linha em `profiles` com `store_id` correto.

### M3 — API Core

- **API-01 · `POST /api/orders`**
  - Ordem EXATA da SPEC §7.3: honeypot vazio → rate limit 5/h/IP/loja (429) → dedup 60s
    (409 sem token) → loja ativa/aberta (409) → bairro ativo ou pickup-only → recálculo
    via `pricing.ts` → divergência = `PRICE_CHANGED` com `{original_total, corrected_total}`
    → `create_order` RPC (transação: orders + items + evento `new` actor customer) →
    responde `tracking_token`.
  - Erros no formato `lib/api-errors.ts` (`{ error: { code, message } }`), copy PT-BR da DS §8.4.
  - DoD: `tests/orders-api.test.ts` casos 1–13 passam (TEST-03 pode ser escrito junto).
  - Proibido: confiar em total/subtotal do client; devolver token no 409; lógica de
    preço fora de `pricing.ts`.
- **API-02 · `PATCH /api/orders/[id]/status`**
  - Valida sessão do lojista da própria loja; chama `set_order_status(..., 'store')`.
  - DoD: transição inválida → 4xx; válida → evento com actor `store`.
- **API-03 · Tracking `GET/POST /api/orders/track/[token]`**
  - GET: pedido mascarado (telefone últimos 2 dígitos, endereço só bairro; nome e notas
    visíveis — SPEC §12), `promised_at`, `canCancel`. POST: cancel via
    `set_order_status(..., 'customer')` só em `new`/`confirmed`.
  - DoD: GET não vaza telefone/endereço completos; cancel fora da janela → 4xx.
- **API-04 · Rotas admin**
  - `stores` CRUD (criar loja + Auth Admin API + senha provisória mostrada 1x),
    `orders/[id]/anonymize` (anonimiza nome, telefone, endereço **e notas**;
    `anonymized_at`).
  - DoD: criar loja retorna senha 1x; anonimizar zera PII mantendo o pedido.
- **API-05 · Cron do salt + auto-cancel** (v3.1: auto-cancel saía órfão)
  - `POST /api/cron/daily-salt` chama **`get_daily_salt()`** (salt do dia) **e `auto_cancel_stale_orders()`** (SPEC §2.29), 00:00
    `America/Manaus`, respeitando `DAILY_SALT_ROTATION_ENABLED`; `vercel.json` se cron.
  - DoD: chamada cria linha do dia + cancela `new` > 24h; segunda chamada no mesmo dia é idempotente.
- **API-06 · Componentes base compartilhados**
  - `status-badge.tsx` (DS §4.11 — 7 estados) criado aqui p/ API/painel reutilizarem.
  - DoD: renderiza os 7 estados com as cores/labels exatas do DS.

### M4 — Vitrine pública (lendo do DB)

- **WEB-00 · Shell**
  - `app/layout.tsx` (pt-BR, metadata, fonts Inter+Sora) + `globals.css` com tokens
    DS §2/2.1 e motion DS §3.
  - DoD: fundo `#f4f1ec`, fontes carregadas, `prefers-reduced-motion` respeitado.
- **WEB-01 · `/` + `queries.ts`**
  - `/` redireciona p/ loja demo (DS §5). `lib/queries.ts` = leituras via RLS;
    `menu-data.ts` reduzido a seed/tipos (não importar em página de produção).
  - DoD: `/` cai na vitrine demo; `queries.ts` é a única fonte de dados da vitrine.
- **WEB-02 · Vitrine `[slug]`** (DS §8.1)
  - Ordem vertical do DS; componentes DS §4.1–4.9; 12 itens/categoria + "ver todos";
    busca normalizada (`norm`): sem acento, case-insensitive, nome+descrição;
    slug inativo/inexistente → `notFound()`; fechada → banner + CTAs off, carrinho mantido;
    produto pausado apagado + itálico.
  - DoD: estados do DS §8.1 todos presentes; busca ignora acento/caixa.
  - Proibido: paginação server-side, filtros novos, cross-sell.
- **WEB-03 · Produto** (DS §8.2) — adicionais, recado 200 chars, stepper 1–20, barra total
  com composição; grava em `lib/cart`; sem cross-sell (decisão DS).
- **WEB-04 · Carrinho** (DS §8.3) — linhas mescladas (produto+adicionais+obs), recibo
  escuro, mínimo exibido (validação real no server), CTA off vazio/abaixo do mínimo/fechada,
  `?demo=1` só quando vazia; limites: 30 linhas, qty 1–20 (`lib/cart`).
- **WEB-05 · Checkout** (DS §8.4) — form completo + honeypot `website` oculto + validações
  client (nome 2–80, fone 10–15, CEP 8 díg., mínimo sobre subtotal, troco ≥ total, loja
  aberta) + envio real p/ `POST /api/orders` + **todos os 8 estados de erro da tabela
  DS §8.4** (alerta PT-BR no topo, carrinho preservado) + `price-change-dialog.tsx`
  (diff item a item + "Confirmar e enviar" com `confirmedPriceDiff=true`).
  - DoD: cada erro da tabela tem o copy exato; `PRICE_CHANGED` nunca grava preço velho.
  - Proibido: copy antecipado fora da tabela; retry automático no `RATE_LIMIT`.
- **WEB-06 · Tracking `[token]`** (DS §8.5) — hero escuro de status, código grande,
  promessa nas DUAS formas ("chega ~19:40" principal + "~25 min" apoio com `live-dot`),
  atrasado em vermelho, cancelado sem cobrança; dados mascarados da API-03; botão
  `wa.me` com mensagem `#CODIGO`; cancelar com motivo ≥3; polling 15s.
  - DoD: estados `?s=new|confirmed|preparing|out|delivered|cancelled` renderizam; máscara ok.

### M5 — Painel lojista

- **PAINEL-01 · Layout + trilho** (DS §8.6) — trilho escuro expansível no hover
  (`78px → 248px`), ícones SVG de traço próprios, badge de novos no ícone Pedidos,
  topbar+pílulas mobile, guard `requireStore` no layout. `mock.ts` só p/ páginas ainda
  sem dados.
  - Proibido: lib de ícones (SVG à mão, traço próprio, como o DS define).
- **PAINEL-02 · Hoje** (DS §8.6) — saudação+data, status com dot, toggle Fechar agora
  (`force_closed`+`force_closed_at`) → "Reabrir" verde + banner "Fechada desde HH:MM",
  3 cards com count-up+sparkline decorativa, "Aguardando ação" gradiente (link pro kanban),
  Últimos 5 com `há N min` (vermelho após 10 min em `new`). Dados reais via `queries.ts`.
- **PAINEL-03 · Kanban** (DS §8.7) — janela = não finalizados + hoje **resolvido no
  servidor** (`America/Manaus`); colunas com scroll horizontal (280px, `snap-x`),
  Pronto/Em rota juntas; "Cancelados (hoje)" colapsada com contador real; card com código,
  `há N min`, pills, CTA Avançar (rótulo por etapa) + ✕ diálogo motivo ≥3; `anim-pop`
  por `key=id-status`; transição via API-02.
  - Proibido: calcular "hoje" no cliente; coluna nova; reorder manual.
- **PAINEL-04 · Detalhe** (DS §8.8) — cabeçalho escuro código gigante, grid Cliente/Itens
  (snapshot + adicionais/obs), linha do tempo com dot vivo no atual e `por
  cliente/loja/sistema`, ações Avançar/Cancelar/Imprimir. Dados de `order_items`/`order_events`.
- **PAINEL-05 · Cupom 80mm** (DS §8.9) — rota fora da sidebar via route group `(print)`;
  `w-[80mm]`, `font-mono`, `@page { size: 80mm auto; margin: 0 }`, `.no-print` nos botões;
  layout do DS (cabeçalho, `#CÓDIGO` gigante, itens com `*** OBS ***`, TOTAL em `====`,
  troco em destaque, link acompanhamento).
  - DoD: preview de impressão do browser sai em 80mm sem sombra/borda/sidebar.
- **PAINEL-06 · Cardápio** (DS §8.10) — contadores (categorias, ativos, teto 200),
  pílulas arrastáveis (drag-and-drop nativo com estado fantasma; sem lib), grade de
  produtos com switch+Editar, adicionais globais com preço. Persistência via RLS
  (`sort_order`/`active`).
- **PAINEL-07 · Ficha produto** (DS §8.11) — `image-uploader.tsx` (DS §4.12: validação
  ≤1MB/1200px, compressão canvas→WebP em `lib/image.ts`, erros PT-BR exatos),
  `price-input.tsx` (R$ → centavos int com prévia ao vivo), adicionais globais checkbox,
  Excluir = `active=false`.
- **PAINEL-08 · Configurações** (DS §8.12) — abas pill (Loja/Horários/Entrega),
  salvamento por aba, editor 7 dias ≤3 faixas com validação fim>início (espelha trigger),
  bairros com switch+taxa+aviso pickup-only, mínimo e preparo mín/máx (alimenta `promised_at`).
- **PAINEL-09 · Limpeza**
  - Deletar `mock.ts` (deletion over addition) — tudo lendo do DB.
  - Pré-condição resolvida na v3.1: `admin/lojas/[id]` usa `ADMIN_ORDERS` próprio (em `app/admin/mock.ts`), não importa mais do painel.
  - DoD: `grep mock` no painel não retorna nada; `grep "painel/mock" app/admin` vazio.

### M6 — Admin operador

- **ADMIN-01 · Shell + guard** (DS §8.13) — `requireAdmin` no layout; `/admin` redireciona.
- **ADMIN-02 · Lista + criar** (DS §8.13) — stats (lojas, ativas, pedidos hoje), filtros
  Todas/Ativas/Inativas + busca, cards com status/dono/pedidos; criar com validação de
  slug `^[a-z0-9-]{3,40}$` + senha provisória aleatória exibida **1 vez** com copiar
  (via API-04/Auth Admin API). Paginação 50/página (SPEC §12).
- **ADMIN-03 · Detalhe loja** (DS §8.13) — vitrine ↗, números, nota de imutabilidade do
  slug, toggle active com aviso 404/painel, reset senha (mostra 1x, "copiar e ocultar"),
  anonimizar LGPD com linha rica e confirmação em 2 cliques.
- **ADMIN-04 · Integração fim-a-fim**
  - Criar loja → logar com a senha provisória → painel funciona.
  - DoD: fluxo completo manual passa; loja inativa → 404 na vitrine.

### M7 — Realtime + UX críticas

- **RT-01 · Realtime no Kanban**
  - Assinar `orders` filtrado por `store_id`; novo pedido/mudança re-renderiza colunas;
    `aria-live="polite"` na região (DS §3.1).
  - DoD: pedido criado pela API aparece no kanban sem reload.
- **RT-02 · Som do painel**
  - Toque curtíssimo **≤150ms**, disparado só **após gesto do usuário dentro do painel**
    (desbloqueio de autoplay); nativo (`Audio`), sem lib.
  - DoD: som toca no novo pedido após interação; nunca toca sem gesto.
- **RT-03 · Favicon badge**
  - Canvas: número sobre fundo vermelho → `toDataURL` no `<link rel="icon">`,
    refeito a cada mudança; `document.title` com o mesmo contador.
  - DoD: aba mostra badge com contagem correta; 0 → sem badge.
- **RT-04 · Fallback "Reconectando"**
  - Realtime caiu → indicador + polling 30s (SPEC §9); tracking mantém polling 15s.
  - DoD: matar a conexão mostra o indicador e o kanban continua atualizando via polling.

### M8 — Testes & CI

- **TEST-01 · Vitest unit** (SPEC §10)
  - `pricing` (subtotal, addons, taxa, mínimo sobre subtotal, troco, arredondamento),
    `store-hours` (faixas, final inclusivo, meia-noite rejeitada, `force_closed`),
    `order-status` (inclui `confirmed→preparing`), `cart`, `code` (4 chars, alfabeto,
    unicidade diária), `wa`, `image` (funções puras).
  - DoD: suite verde; sem coverage gate, sem snapshot visual (SPEC §10).
- **TEST-02 · `tests/rls.sql`** — as 9 asserções da SPEC §10 com a metodologia exata
  (`BEGIN`, `set local role`, `raise 'FALHA'` FORA do `exception`, `ROLLBACK` final).
  - DoD: 9 asserções passam contra o DB migrado.
- **TEST-03 · `tests/orders-api.test.ts`** — os 13 casos da SPEC §10 (total adulterado
  ignorado; `price_changed`; dedup 409 sem token; rate limit 429; item indisponível 422
  com nome; `force_closed` 409; bairro não configurado 422; honeypot 400; abaixo do
  mínimo 422; pix sem troco; `promised_at`/`ip_hash` gravados; CEP obrigatório 422;
  CEP 8 dígitos).
- **TEST-04 · Playwright** — 3 cenários (happy path, cancelamento cliente, rate limit),
  desktop + mobile 390×844 (SPEC §10).
- **TEST-05 · CI** — um workflow: typecheck + lint + vitest + `db push` local +
  `rls.sql` + testes de API + Playwright. **CI falha se `pg_publication_tables` não
  contiver `orders`** (SPEC §9).
- **TEST-06 · Bateria final (critério binário)**
  - Ensaio do dia inteiro: 1 loja real, ≥30 pedidos aceitos e entregues, 0 erro de
    checkout, 0 falha RLS.
  - DoD: critério da SPEC §1 **verdade**.

---

## 7. Protocolo de exceção (quando algo não está no plano)

Quando a IA encontrar um caso não coberto pela SPEC/DS/plano (ou conflito entre eles):

1. **PARAR** a task. Não criar arquivo, dependência ou "solução temporária".
2. Reportar ao supervisor com: (a) o caso, (b) as seções consultadas (SPEC §x / DS §y),
   (c) por que está fora, (d) proposta **mínima** de resolução.
3. **Só prosseguir após aprovação**. Se a resolução mudar SPEC ou DS, a mudança entra
   nos documentos primeiro (fonte de verdade), depois no código.

Conflito entre fontes resolve assim: SPEC vence DS em regra de negócio; DS vence SPEC
em aparência/interação; este plano vence ambos em ordem e escopo.

---

## 8. DoD global + checklist final

- [ ] Todos os 8 milestones com DoD verdadeiro e checkpoint aprovado
- [ ] Critério binário da SPEC §1 verdadeiro (ensaio do dia inteiro)
- [ ] 9 asserções RLS verdes · 13 casos de API verdes · Playwright 3 cenários verdes
- [ ] `grep` confirma: zero arquivo fora da §4.1, zero dependência fora da §4.2
- [ ] Zero menção a itens da SPEC §3.2 (fora de escopo) no código
- [ ] Erro de API 100% no formato `{ error: { code, message } }` com copy da DS §8.4
- [ ] Dinheiro 100% em centavos int; `Intl pt-BR BRL` na exibição
- [ ] A11y DS §3.1 verificada nas 13 telas
- [ ] `mock.ts` deletado; vitrine e painel 100% do DB

---

## 9. Estimativa (t-shirt, sem data — o ritmo é do supervisor)

| Milestone | Tamanho | Observação |
|---|---|---|
| M1 Infra/DB | M | SQL é copiado da SPEC — risco baixo |
| M2 Auth | S | 3 arquivos + login mínima |
| M3 API Core | M–L | `create_order` é o coração; TEST-03 junto |
| M4 Vitrine | L | 5 rotas + estados de erro |
| M5 Painel | L | 8 telas; cupom e kanban são as críticas |
| M6 Admin | S–M | 2 telas + Auth Admin API |
| M7 Realtime+UX | S | 4 tasks pontuais |
| M8 Testes/CI | M | TEST-02/03 já nasceram nos milestones |

---

**Fim do Plano v1.** Próxima etapa da esteira: **executar M1** (scaffold + schema) —
ou extrair backlog se o supervisor preferir board primeiro.
