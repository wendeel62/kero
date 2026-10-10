# Kero — Backlog v1 (Esteira Etapa 4)

> **Tasks prontas para execução.** Derivado 1:1 do §6 do Plano de Execução
> (`docs/superpowers/plans/2026-10-06-kero-v1-execution-plan.md`) — **nenhuma task nova,
> nenhuma omitida**. Regras de negócio: SPEC v3. Visual: Design System.
>
> Execução por **IA**, supervisão por **checkpoint de milestone** (plano §0 item 8).

---

## 0. Como usar este backlog

1. **Ordem**: executar por dependência (`Deps`) dentro de cada milestone; nunca pular
   milestone (grafo do plano §2).
2. **Antes de iniciar uma task**: ler as seções de SPEC/DS listadas em `refs`.
3. **Estados**: `todo` → `in_progress` → `review` (checkpoint) → `done`.
   Atualizar `status` na task e no board (§1).
4. **DoD é binário**: marcar `[x]` só quando o item for verdadeiro e verificável.
5. **Task nova ou caso fora do backlog** → Protocolo de exceção do plano §7
   (PARAR, reportar, aguardar aprovação).
6. Uma task por vez; commit(s) com mensagem referenciando o ID.

---

## 1. Board (visão geral — atualizar `status` aqui)

| ID | Task | Deps | Tam | Status |
|---|---|---|---|---|
| DB-01 | Scaffold Supabase + env | — | S | `review` |
| DB-02 | Migration `001_schema.sql` | DB-01 | M | `review` |
| DB-03 | Migration `002_functions_triggers.sql` | DB-02 | M | `review` |
| DB-04 | Migration `003_rls.sql` | DB-03 | S | `review` |
| DB-05 | Migration `004_realtime_storage.sql` | DB-04 | S | `review` |
| DB-06 | Seed da loja demo | DB-02 | S | `review` |
| AUTH-01 | Clientes Supabase | DB-01 | S | `todo` |
| AUTH-02 | Guards `requireStore`/`requireAdmin` | AUTH-01 | S | `todo` |
| AUTH-03 | Página `/login` (infra mínima) | AUTH-02 | S | `todo` |
| AUTH-04 | Sincronia `profiles` | AUTH-01 | S | `todo` |
| API-01 | `POST /api/orders` | API-06 | L | `todo` |
| API-02 | `PATCH /api/orders/[id]/status` | API-06 | S | `todo` |
| API-03 | Tracking `GET/POST /api/orders/track/[token]` | API-06 | S | `todo` |
| API-04 | Rotas admin (stores + anonymize) | AUTH-02 | M | `todo` |
| API-05 | Cron do salt | DB-03 | S | `todo` |
| API-06 | Componentes base + `lib` de contrato | AUTH-01 | M | `todo` |
| WEB-00 | Shell (layout + globals.css) | — | S | `todo` |
| WEB-01 | `/` + `queries.ts` | WEB-00, DB-06 | S | `todo` |
| WEB-02 | Vitrine `[slug]` | WEB-01 | L | `todo` |
| WEB-03 | Produto `[id]` | WEB-02 | M | `todo` |
| WEB-04 | Carrinho | WEB-02 | M | `todo` |
| WEB-05 | Checkout | WEB-04, API-01 | L | `todo` |
| WEB-06 | Tracking `[token]` | API-03 | M | `todo` |
| PAINEL-01 | Layout + trilho + guard | AUTH-02 | M | `todo` |
| PAINEL-02 | Hoje | PAINEL-01 | M | `todo` |
| PAINEL-03 | Kanban | PAINEL-02, API-02 | L | `todo` |
| PAINEL-04 | Detalhe do pedido | PAINEL-03 | M | `todo` |
| PAINEL-05 | Cupom 80mm | PAINEL-04 | S | `todo` |
| PAINEL-06 | Cardápio | PAINEL-01 | M | `todo` |
| PAINEL-07 | Ficha do produto | PAINEL-06 | M | `todo` |
| PAINEL-08 | Configurações | PAINEL-01 | M | `todo` |
| PAINEL-09 | Limpeza (`mock.ts`) | PAINEL-02–08 | S | `todo` |
| ADMIN-01 | Shell + guard | AUTH-02 | S | `todo` |
| ADMIN-02 | Lista + criar loja | ADMIN-01, API-04 | M | `todo` |
| ADMIN-03 | Detalhe da loja | ADMIN-02 | M | `todo` |
| ADMIN-04 | Integração fim-a-fim | ADMIN-03 | S | `todo` |
| RT-01 | Realtime no Kanban | PAINEL-03 | S | `todo` |
| RT-02 | Som do painel | RT-01 | S | `todo` |
| RT-03 | Favicon badge | RT-01 | S | `todo` |
| RT-04 | Fallback "Reconectando" | RT-01 | S | `todo` |
| TEST-01 | Vitest unit | M3+ | M | `todo` |
| TEST-02 | `tests/rls.sql` (9 asserções) | DB-04 | M | `todo` |
| TEST-03 | `tests/orders-api.test.ts` (13 casos) | API-01 | M | `todo` |
| TEST-04 | Playwright (3 cenários) | WEB-06, PAINEL-04 | M | `todo` |
| TEST-05 | CI | TEST-01–04 | S | `todo` |
| TEST-06 | Bateria final (critério binário) | todos | M | `todo` |

---

## 2. Tasks detalhadas

Formato: **Meta** (deps · tam · refs · status) · **O quê** · **Arquivos** · **DoD** ·
**Proibido** (quando aplicável).

### M1 — Infra & DB

#### DB-01 — Scaffold Supabase + env
**Meta:** deps: — · tam: S · refs: SPEC §13 · status: `review`
**O quê:** Inicializar projeto Supabase local; criar pasta de migrations; `.env.example`
com as 5 vars da SPEC §13.
**Arquivos:** `supabase/config.toml`, `supabase/migrations/` (vazia), `.env.example`
**DoD:**
- [ ] `supabase db push` roda sem erro (zero migrations)
- [ ] `.env.example` contém exatamente: `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
      `DAILY_SALT_ROTATION_ENABLED`, `NEXT_PUBLIC_APP_NAME`

#### DB-02 — Migration `001_schema.sql`
**Meta:** deps: DB-01 · tam: M · refs: SPEC §5 · status: `review`
**O quê:** SQL literal da SPEC §5 — 10 tabelas (`stores, profiles, daily_salt,
categories, products, product_addons, neighborhoods, orders, order_items, order_events`)
+ todos os índices + `unique (store_id, code, dia America/Manaus)` + FKs compostas
`(id, store_id)` + checks.
**Arquivos:** `supabase/migrations/001_schema.sql`
**DoD:**
- [ ] push ok
- [ ] `psql` lista as 10 tabelas
- [ ] índices da SPEC §5 existem (`idx_orders_store_status_created`, etc.)
- [ ] insert de teste respeita checks (ex.: `code` com 5 chars falha)
**Proibido:** inventar coluna nova, trocar tipo, remover check/constraint, "melhorar" o SQL da spec.

#### DB-03 — Migration `002_functions_triggers.sql`
**Meta:** deps: DB-02 · tam: M · refs: SPEC §6 · status: `review`
**O quê:** Funções/triggers da SPEC §6: `enforce_order_status_transition`,
`protect_store_columns` (slug imutável, `active` só service_role), `validate_open_hours`
(final>inicial, máx 3/dia), `set_order_status` (security definer, valida actor/canTransition,
grava evento), `create_order` (ordem de validação da SPEC §7.3), `fn_check_order_items_limit`
(30 linhas), `trg_enforce_max_products_loja` (200), `get_daily_salt`, `calculate_ip_hash`,
`promise_time`.
**Arquivos:** `supabase/migrations/002_functions_triggers.sql`
**DoD:**
- [ ] push ok
- [ ] `set_order_status` manual grava `order_events` com `actor`
- [ ] transição inválida (`new→delivered`) falha
- [ ] `calculate_ip_hash` retorna sha256 estável para o mesmo IP/dia
**Proibido:** lógica de negócio em TypeScript que pertence ao SQL (rate limit, dedup, recálculo ficam em `create_order`).

#### DB-04 — Migration `003_rls.sql`
**Meta:** deps: DB-03 · tam: S · refs: SPEC §6 · status: `review`
**O quê:** RLS na tabela da SPEC §6: policies anon (SELECT `active=true` em catálogo,
nada em orders), lojista (ALL próprio `store_id`), admin (service role) + `auth_store_id()`
+ column grants (`revoke update on orders from authenticated; grant update (status,
cancellation_reason, canceled_by, updated_at) on orders to authenticated`).
**Arquivos:** `supabase/migrations/003_rls.sql`
**DoD:**
- [ ] push ok
- [ ] anon não lê `orders` (query falha)
- [ ] anon lê `products` ativos
- [ ] lojista não altera `total_cents` (grant bloqueia)

#### DB-05 — Migration `004_realtime_storage.sql`
**Meta:** deps: DB-04 · tam: S · refs: SPEC §4 · status: `review`
**O quê:** `alter publication supabase_realtime add table orders;` + bucket `store-assets`
(pastas `logos/`, `products/`) + policies de storage.
**Arquivos:** `supabase/migrations/004_realtime_storage.sql`
**DoD:**
- [ ] `select * from pg_publication_tables` contém `orders`
- [ ] bucket `store-assets` existe com policies de upload restritas

#### DB-06 — Seed da loja demo
**Meta:** deps: DB-02 · tam: S · refs: DS §1 item 14, DS §5 · status: `review`
**O quê:** `seed.sql` convertendo `menu-data.ts` (loja demo + cardápio + bairros +
adicionais) em INSERTs.
**Arquivos:** `supabase/seed.sql`
**DoD:**
- [ ] `select` retorna loja demo ativa
- [ ] ≥2 categorias, ≥6 produtos, ≥2 bairros, adicionais globais
- [ ] `/` (WEB-01) cai na vitrine demo

### M2 — Auth & guards

#### AUTH-01 — Clientes Supabase
**Meta:** deps: DB-01 · tam: S · refs: SPEC §4, §6 · status: `todo`
**O quê:** `lib/supabase/client.ts` (browser), `server.ts` (server component),
`admin.ts` (service role, server-side ONLY).
**Arquivos:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`
**DoD:**
- [ ] import em server component funciona
- [ ] `admin.ts` quebra/é recusado se importado no browser
- [ ] chaves vêm das env vars da SPEC §13

#### AUTH-02 — Guards `requireStore`/`requireAdmin`
**Meta:** deps: AUTH-01 · tam: S · refs: SPEC §6, DS §8.6/§8.13 · status: `todo`
**O quê:** `lib/auth.ts`: `requireStore()` (profile `store_id`; sem sessão →
redirect `/login`), `requireAdmin()` (`role='admin'`). `painel/layout.tsx` chama
`requireStore()`, `admin/layout.tsx` chama `requireAdmin()` — um ponto de guarda por área.
**Arquivos:** `lib/auth.ts`
**DoD:**
- [ ] sem login, `/painel` e `/admin` redirecionam para `/login`
- [ ] login `loja` acessa `/painel` mas não `/admin`
- [ ] login `admin` acessa `/admin`
**Proibido:** middleware extra; guard repetido página por página.

#### AUTH-03 — Página `/login` (infra mínima)
**Meta:** deps: AUTH-02 · tam: S · refs: SPEC §6, DS §2 · status: `todo`
**O quê:** Form e-mail+senha, reusa tokens DS §2 (zero design novo), redirect por role
(`loja`→`/painel`, `admin`→`/admin`). Infra necessária não prevista na SPEC §4 —
comentário `ponytail:` no código.
**Arquivos:** `app/login/page.tsx`, `app/login/login-client.tsx`
**DoD:**
- [ ] login com usuário de teste redireciona por role
- [ ] erro mostra mensagem PT-BR
- [ ] nenhum estilo novo fora dos tokens DS §2

#### AUTH-04 — Sincronia `profiles`
**Meta:** deps: AUTH-01 · tam: S · refs: SPEC §5 (profiles), §6 · status: `todo`
**O quê:** Trigger `fn_on_signup` cria `profiles` no signup. Usuário de teste via Supabase
Studio (signup público está `false`).
**Arquivos:** `supabase/migrations/005_profiles_trigger.sql` (v3.1 — não editar a 002, já aplicada)
**DoD:**
- [ ] usuário de teste tem linha em `profiles` com `store_id`/`role` corretos
- [ ] signup novo cria profile automaticamente

### M3 — API Core

#### API-06 — Componentes base + `lib` de contrato
**Meta:** deps: AUTH-01 · tam: M · refs: SPEC §4, §11, DS §4 item 11 · status: `todo`
**O quê:** `lib/pricing.ts` (única fonte de totais, centavos int), `order-status.ts`
(máquina + `STATUS_LABEL` PT-BR), `store-hours.ts` (TZ `America/Manaus`),
`code.ts` (4 chars, alfabeto sem I/O/0/1, retry 6x), `api-errors.ts`
(`{ error: { code, message } }`), `status-badge.tsx` (DS §4.11 — 7 estados).
**Arquivos:** `lib/pricing.ts`, `lib/order-status.ts`, `lib/store-hours.ts`, `lib/code.ts`,
`lib/api-errors.ts`, `components/ui/status-badge.tsx`
**DoD:**
- [ ] `pricing` calcula subtotal+addons+taxa+total em centavos int
- [ ] `order-status` inclui `confirmed→preparing`; `delivered` é final
- [ ] `store-hours` respeita `force_closed` e TZ `America/Manaus`
- [ ] `code` gera 4 chars do alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
- [ ] `api-errors` retorna o formato exato da SPEC §11
- [ ] `StatusBadge` renderiza os 7 estados com cores/labels exatas do DS §4.11

#### API-01 — `POST /api/orders`
**Meta:** deps: API-06 · tam: L · refs: SPEC §7.3, §9, DS §8.4 · status: `todo`
**O quê:** Ordem EXATA da SPEC §7.3: honeypot vazio → rate limit 5/h/IP/loja (429) →
dedup 60s (409 sem token) → loja ativa/aberta (409) → bairro ativo ou pickup-only →
recálculo via `pricing.ts` → divergência = `PRICE_CHANGED` com
`{original_total, corrected_total}` → `create_order` RPC (transação) → responde
`tracking_token`. Erros no formato `api-errors.ts`, copy PT-BR da DS §8.4.
**Arquivos:** `app/api/orders/route.ts`
**DoD:**
- [ ] honeypot preenchido → 400
- [ ] 6º pedido na hora → 429 `RATE_LIMIT`
- [ ] dedup 60s → 409 `DUPLICATE` **sem token** + wa.me
- [ ] loja fechada → 409 `STORE_CLOSED`
- [ ] total adulterado do client é ignorado (recálculo vence)
- [ ] `PRICE_CHANGED` devolve `{original_total, corrected_total}`
- [ ] pedido criado tem `promised_at` + `ip_hash` + evento `new` actor `customer`
**Proibido:** confiar em total/subtotal do client; devolver token no 409; lógica de preço fora de `pricing.ts`; retry automático no `RATE_LIMIT`.

#### API-02 — `PATCH /api/orders/[id]/status`
**Meta:** deps: API-06 · tam: S · refs: SPEC §6, §7.5 · status: `todo`
**O quê:** Valida sessão do lojista da própria loja; chama `set_order_status(..., 'store')`.
**Arquivos:** `app/api/orders/[id]/status/route.ts`
**DoD:**
- [ ] transição inválida → 4xx
- [ ] válida → evento com `actor='store'`
- [ ] lojista de outra loja → 4xx (não vaza)

#### API-03 — Tracking `GET/POST /api/orders/track/[token]`
**Meta:** deps: API-06 · tam: S · refs: SPEC §7.4, §12 · status: `todo`
**O quê:** GET: pedido mascarado (telefone últimos 2 dígitos, endereço só bairro; nome e
notas visíveis), `promised_at`, `canCancel`. POST: cancel via `set_order_status(...,
'customer')` só em `new`/`confirmed`.
**Arquivos:** `app/api/orders/track/[token]/route.ts`
**DoD:**
- [ ] GET não vaza telefone/endereço completos
- [ ] cancel fora de `new`/`confirmed` → 4xx
- [ ] cancel com motivo <3 chars → 4xx
- [ ] token inválido → 404

#### API-04 — Rotas admin (stores + anonymize)
**Meta:** deps: AUTH-02 · tam: M · refs: SPEC §7, §8.13, DS §8.13 · status: `todo`
**O quê:** `stores` CRUD (criar loja + Auth Admin API + senha provisória exibida 1x),
`orders/[id]/anonymize` (anonimiza nome, telefone, endereço **e notas**; `anonymized_at`).
**Arquivos:** `app/api/admin/stores/route.ts`, `app/api/admin/orders/[id]/anonymize/route.ts`
**DoD:**
- [ ] criar loja valida slug `^[a-z0-9-]{3,40}$` e retorna senha **1x**
- [ ] anonimizar zera PII mantendo o pedido
- [ ] só `role='admin'` acessa (guard)

#### API-05 — Cron do salt + auto-cancel
**Meta:** deps: DB-03 · tam: S · refs: SPEC §2.22, §2.29, §13, v3.1 #19 · status: `todo`
**O quê:** `POST /api/cron/daily-salt` chama `get_daily_salt()` (salt do dia) **e**
`auto_cancel_stale_orders()` (auto-cancel `new` > 24h, SPEC §2.29 — estava órfão), 00:00
`America/Manaus`, respeitando `DAILY_SALT_ROTATION_ENABLED`); `vercel.json` se cron.
**Arquivos:** `app/api/cron/daily-salt/route.ts`, `vercel.json`
**DoD:**
- [ ] chamada cria linha do dia + cancela `new` > 24h
- [ ] segunda chamada no mesmo dia é idempotente
- [ ] `DAILY_SALT_ROTATION_ENABLED=false` desliga

### M4 — Vitrine pública (lendo do DB)

#### WEB-00 — Shell (layout + globals.css)
**Meta:** deps: — · tam: S · refs: DS §1, §2, §3 · status: `todo`
**O quê:** `app/layout.tsx` (html pt-BR, metadata, fonts Inter+Sora) + `globals.css`
com tokens DS §2/2.1 e motion DS §3 (CSS puro, keyframes, `prefers-reduced-motion`).
**Arquivos:** `app/layout.tsx`, `app/globals.css`
**DoD:**
- [ ] fundo `#f4f1ec`, fontes carregadas
- [ ] tokens dark §2.1 presentes no CSS
- [ ] `prefers-reduced-motion` respeitado

#### WEB-01 — `/` + `queries.ts`
**Meta:** deps: WEB-00, DB-06 · tam: S · refs: DS §5, §6 · status: `todo`
**O quê:** `/` redireciona para a loja demo. `lib/queries.ts` = leituras via RLS;
`menu-data.ts` reduzido a seed/tipos (não importar em página de produção).
**Arquivos:** `app/page.tsx`, `lib/queries.ts`, `app/[slug]/menu-data.ts`
**DoD:**
- [ ] `/` cai na vitrine demo
- [ ] `queries.ts` é a única fonte de dados da vitrine
- [ ] `grep menu-data app/[slug]/page.tsx` vazio (só seed/tipos)

#### WEB-02 — Vitrine `[slug]`
**Meta:** deps: WEB-01 · tam: L · refs: DS §8.1, §4 itens 1–9, SPEC §3.1, §8 · status: `todo`
**O quê:** Ordem vertical do DS §8.1 (faixa gradiente → topbar → letreiro → hero →
pílulas → seções → "Da nossa porta" → rodapé); componentes DS §4.1–4.9; 12 itens/categoria
+ "ver todos"; busca normalizada (`norm`: sem acento, case-insensitive, nome+descrição);
slug inativo/inexistente → `notFound()`; fechada → banner + CTAs off (carrinho mantido);
produto pausado apagado + itálico; aside desktop + sacola mobile; a11y DS §3.1.
**Arquivos:** `app/[slug]/page.tsx`, `app/[slug]/vitrine-client.tsx` (nome real, v3.1)
**DoD:**
- [ ] todos os estados do DS §8.1 presentes (busca vazia, fechada, pausado)
- [ ] busca ignora acento/caixa (ex.: "caipirinha" acha "Caipirinha")
- [ ] slug inativo → 404 (não vaza)
- [ ] 12 itens + "ver todos os N sabores"
- [ ] contador da sacola com `role="status"`
**Proibido:** paginação server-side, filtros novos, cross-sell, `max-w` > 6xl.

#### WEB-03 — Produto `[id]`
**Meta:** deps: WEB-02 · tam: M · refs: DS §8.2 · status: `todo`
**O quê:** Foto grande + chip categoria + selo preço; título + faixa infos; seção 1
Adicionais (checkbox, highlight `bg-red-50/60`); seção 2 Recado (contador 200); barra
total fixa com composição; stepper 1–20; grava em `lib/cart`; sem cross-sell (decisão DS).
**Arquivos:** `app/[slug]/produto/[id]/page.tsx`, `app/[slug]/produto/[id]/produto-client.tsx`
**DoD:**
- [ ] estados do DS §8.2 presentes (pausado/fechada desabilitam com aviso)
- [ ] id/loja inválida → 404
- [ ] metadata OG por produto
- [ ] total = composição `N × base+adicionais` em centavos

#### WEB-04 — Carrinho
**Meta:** deps: WEB-02 · tam: M · refs: DS §8.3, SPEC §2.20 · status: `todo`
**O quê:** Stepper de etapas; linhas mescladas (produto+adicionais+obs, soma qty);
recibo escuro com `receipt-div`; mínimo exibido (validação real no server); CTA off
vazio/abaixo do mínimo/fechada; `?demo=1` só quando vazia; `lib/cart` com limites
30 linhas, qty 1–20, chave `kero:cart:v1:<slug>`.
**Arquivos:** `app/[slug]/carrinho/page.tsx`, `app/[slug]/carrinho/carrinho-client.tsx`,
`lib/cart.ts`
**DoD:**
- [ ] mesma linha mescla e soma qty
- [ ] produto fora do cardápio some da lista
- [ ] CTA off quando vazio/abaixo do mínimo/fechada
- [ ] limites: 30 linhas, qty 1–20

#### WEB-05 — Checkout
**Meta:** deps: WEB-04, API-01 · tam: L · refs: DS §8.4, SPEC §7.3, §9 · status: `todo`
**O quê:** Form completo (nome, WhatsApp, entrega/retirada, endereço+bairro+CEP 8 díg.,
pagamento, troco, obs 300) + honeypot `website` oculto + validações client (nome 2–80,
fone 10–15, mínimo sobre subtotal, troco ≥ total, loja aberta) + envio real para
`POST /api/orders` + **os 8 estados de erro da tabela DS §8.4** (alerta PT-BR no topo,
carrinho preservado) + `price-change-dialog.tsx` (diff item a item + "Confirmar e enviar"
com `confirmedPriceDiff=true`).
**Arquivos:** `app/[slug]/checkout/page.tsx`, `app/[slug]/checkout/checkout-client.tsx`,
`components/ui/price-change-dialog.tsx`
**DoD:**
- [ ] cada erro da tabela DS §8.4 tem o copy exato
- [ ] `PRICE_CHANGED` mostra diff e nunca grava preço velho
- [ ] carrinho preservado em qualquer erro
- [ ] pickup-only automático se 0 bairros ativos
- [ ] troco só para dinheiro; foco no campo em `TROCO_INSUFICIENTE`
**Proibido:** copy antecipado fora da tabela; retry automático no `RATE_LIMIT`; link de acompanhamento no `DUPLICATE`.

#### WEB-06 — Tracking `[token]`
**Meta:** deps: API-03 · tam: M · refs: DS §8.5, SPEC §7.4, §11 · status: `todo`
**O quê:** Stepper etapa 3; hero escuro de status (código grande, rótulo PT-BR, promessa,
barra 5 estágios, emoji); promessa nas DUAS formas ("chega ~19:40" principal +
"~25 min" apoio com `live-dot`); atrasado em vermelho; cancelado sem cobrança; dados
mascarados da API-03; botão `wa.me` com mensagem `#CODIGO`; cancelar com motivo ≥3;
polling 15s; previews `?s=new|confirmed|preparing|out|delivered|cancelled`.
**Arquivos:** `app/[slug]/pedido/[token]/page.tsx`, `app/[slug]/pedido/[token]/pedido-client.tsx`
**DoD:**
- [ ] os 6 estados renderizam
- [ ] máscara de telefone/endereço ok
- [ ] cancelar só em `new`/`confirmed`, motivo ≥3
- [ ] polling 15s sem travar UI

### M5 — Painel lojista

#### PAINEL-01 — Layout + trilho + guard
**Meta:** deps: AUTH-02 · tam: M · refs: DS §8.6 · status: `todo`
**O quê:** Route group `(dash)`; trilho escuro expansível no hover (`78px → 248px`,
labels fade+slide, ícones SVG de traço próprios, badge de novos no ícone Pedidos);
topbar+pílulas mobile; guard `requireStore` no layout. `mock.ts` só para páginas ainda
sem dados.
**Arquivos:** `app/(dash)/painel/layout.tsx`, `app/painel/mock.ts`
**DoD:**
- [ ] trilho expande/recolhe no hover sem lib de animação
- [ ] sem login → redirect `/login`
- [ ] ícones SVG à mão (traço próprio)
**Proibido:** lib de ícones; lib de animação; animações laterais em badges.

#### PAINEL-02 — Hoje
**Meta:** deps: PAINEL-01 · tam: M · refs: DS §8.6 · status: `todo`
**O quê:** Saudação por horário + data; status da loja com dot; toggle Fechar agora
(`force_closed`+`force_closed_at`) → "Reabrir" verde + banner "Fechada desde HH:MM";
3 cards com count-up + sparkline decorativa; "Aguardando ação" gradiente com glow (link
pro kanban); Últimos 5 com avatar de inicial, pill de status, `há N min` (vermelho +
"precisa de você" após 10 min em `new`). Dados reais via `queries.ts`.
**Arquivos:** `app/(dash)/painel/page.tsx`
**DoD:**
- [ ] toggle grava `force_closed` real (RLS)
- [ ] faturamento hoje exclui cancelados
- [ ] cards com count-up; sparkline decorativa

#### PAINEL-03 — Kanban
**Meta:** deps: PAINEL-02, API-02 · tam: L · refs: DS §8.7, SPEC §6, §8 · status: `todo`
**O quê:** Janela = não finalizados + hoje **resolvido no servidor** (`America/Manaus`
via `store-hours.ts`/`queries.ts`); colunas com scroll horizontal (280px, `snap-x`),
Pronto/Em rota juntas; "Cancelados (hoje)" colapsada com contador real; card com código,
`há N min` (vermelho + 🔴 após 10 min em `new`), "Aguardando X min", nome, pills
entrega/retirada/pagamento, total, CTA Avançar (rótulo por etapa) + ✕ diálogo motivo ≥3;
`anim-pop` por `key=id-status`; transição via API-02.
**Arquivos:** `app/(dash)/painel/pedidos/page.tsx`
**DoD:**
- [ ] "hoje" resolvido no servidor (não no cliente)
- [ ] máquina de estados espelha `order-status.ts`
- [ ] cancelado exige motivo ≥3
- [ ] janela = não finalizados + hoje
**Proibido:** calcular "hoje" no cliente; coluna nova; reorder manual.

#### PAINEL-04 — Detalhe do pedido
**Meta:** deps: PAINEL-03 · tam: M · refs: DS §8.8 · status: `todo`
**O quê:** Cabeçalho escuro código gigante + pill status + chips; grid Cliente (wa.me
verde, endereço/retirada, pagamento+troco) e Itens (snapshot + adicionais/obs);
linha do tempo vertical com dot vivo no atual e `por cliente/loja/sistema`; ações
Avançar (rótulo do próximo status) + Cancelar (motivo ≥3) + Imprimir 80mm.
**Arquivos:** `app/(dash)/painel/pedidos/[id]/page.tsx`
**DoD:**
- [ ] itens/eventos reais de `order_items`/`order_events`
- [ ] timeline mostra actor
- [ ] avançar/cancelar via API-02

#### PAINEL-05 — Cupom 80mm
**Meta:** deps: PAINEL-04 · tam: S · refs: DS §8.9, SPEC §2.24 · status: `todo`
**O quê:** Route group `(print)` fora da sidebar; coluna `w-[80mm]`, `font-mono`,
`@page { size: 80mm auto; margin: 0 }`; `.no-print` nos botões; layout do DS
(cabeçalho nome/fone, `#CÓDIGO` gigante, tipo em destaque, cliente caixa alta, itens com
`*** OBS ***`, TOTAL em `====`, troco em destaque, link acompanhamento, rodapé).
**Arquivos:** `app/(print)/painel/pedidos/[id]/print/page.tsx`
**DoD:**
- [ ] preview de impressão sai em 80mm sem sombra/borda/sidebar
- [ ] usa `ITEM_SETS` compartilhado (não duplica dados)

#### PAINEL-06 — Cardápio
**Meta:** deps: PAINEL-01 · tam: M · refs: DS §8.10 · status: `todo`
**O quê:** Cabeçalho com contadores (categorias, ativos, teto 200) + CTA Novo produto;
pílulas arrastáveis (drag-and-drop nativo, estado fantasma, âncora, criar inline);
grade 2 col mobile / 4 col desktop, cards compactos (thumb, nome, preço, switch+Editar);
adicionais globais com switch, preço, criar inline. Persistência via RLS
(`sort_order`/`active`).
**Arquivos:** `app/(dash)/painel/cardapio/page.tsx`
**DoD:**
- [ ] drag-and-drop persiste `sort_order`
- [ ] toggle persiste `active`
- [ ] teto 200 exibido (trigger do banco vira erro tratado)
**Proibido:** lib de drag-and-drop (HTML5 nativo).

#### PAINEL-07 — Ficha do produto
**Meta:** deps: PAINEL-06 · tam: M · refs: DS §8.11, §4 item 12 · status: `todo`
**O quê:** `novo` abre em branco, id abre preenchido (404 se inexistente). Foto com
`image-uploader.tsx` (validação ≤1MB/1200px, compressão canvas→WebP em `lib/image.ts`,
erros PT-BR exatos); Dados (nome, descrição, `price-input.tsx` R$→centavos com prévia
ao vivo, categoria, ordem, switch); Adicionais (globais checkbox + link gestão).
**Arquivos:** `app/(dash)/painel/cardapio/produtos/[id]/page.tsx`,
`components/ui/image-uploader.tsx`, `components/ui/price-input.tsx`, `lib/image.ts`
**DoD:**
- [ ] upload persiste no bucket `store-assets/products/{store_id}/{product_id}.webp`
- [ ] erros PT-BR exatos do DS §4.12
- [ ] preço R$ → centavos int com prévia
- [ ] Excluir documenta `active=false`

#### PAINEL-08 — Configurações
**Meta:** deps: PAINEL-01 · tam: M · refs: DS §8.12 · status: `todo`
**O quê:** Abas pill (Loja/Horários/Entrega) com salvamento por aba e erros listados.
Loja: nome, WhatsApp só-dígitos, descrição, Pix, logo (tile + nota do bucket).
Horários: 7 dias com switch, até 3 faixas `time` com +/✕, validação fim>início
(espelha trigger). Entrega: bairros com switch+taxa+remover/criar, aviso pickup-only,
mínimo (sobre subtotal), preparo mín/máx (alimenta `promised_at`).
**Arquivos:** `app/(dash)/painel/configuracoes/page.tsx`
**DoD:**
- [ ] salvamento por aba grava em `stores` com RLS
- [ ] validação de faixas espelha o trigger
- [ ] aviso pickup-only quando 0 bairros ativos

#### PAINEL-09 — Limpeza
**Meta:** deps: PAINEL-02–08 · tam: S · refs: plano §6 M5 · status: `todo`
**O quê:** Deletar `app/painel/mock.ts` (deletion over addition) — tudo lendo do DB.
Pré-condição resolvida na v3.1: `admin/lojas/[id]` usa `ADMIN_ORDERS` (em `app/admin/mock.ts`).
**Arquivos:** `app/painel/mock.ts` (delete)
**DoD:**
- [ ] `grep mock` no painel não retorna nada
- [ ] `grep "painel/mock" app/admin` vazio
- [ ] nenhuma página quebra

### M6 — Admin operador

#### ADMIN-01 — Shell + guard
**Meta:** deps: AUTH-02 · tam: S · refs: DS §8.13 · status: `todo`
**O quê:** Route group `(admin)`; `requireAdmin` no layout; `/admin` redireciona p/ lista.
**Arquivos:** `app/(admin)/admin/layout.tsx`, `app/(admin)/admin/page.tsx`
**DoD:**
- [ ] sem login → `/login`; login `loja` → bloqueado
- [ ] `/admin` → `/admin/lojas`

#### ADMIN-02 — Lista + criar loja
**Meta:** deps: ADMIN-01, API-04 · tam: M · refs: DS §8.13, SPEC §12 · status: `todo`
**O quê:** Stats (lojas, ativas, pedidos hoje); filtros Todas/Ativas/Inativas + busca;
cards com status, dono, pedidos e "desde", chevron; criar com validação de slug
`^[a-z0-9-]{3,40}$` + senha provisória aleatória exibida **1 vez** com copiar (via API-04).
Paginação 50/página.
**Arquivos:** `app/(admin)/admin/lojas/page.tsx`
**DoD:**
- [ ] criar loja retorna senha 1x com copiar
- [ ] slug inválido → erro PT-BR
- [ ] paginação 50/página

#### ADMIN-03 — Detalhe da loja
**Meta:** deps: ADMIN-02 · tam: M · refs: DS §8.13 · status: `todo`
**O quê:** Vitrine ↗, números (pedidos, faturamento, slug), nota de imutabilidade do
slug, toggle active com aviso 404/painel, reset senha (mostra 1x, "copiar e ocultar"),
anonimizar LGPD com linha rica (total, tempo, tipo, pagamento) e confirmação em 2 cliques.
**Arquivos:** `app/(admin)/admin/lojas/[id]/page.tsx`
**DoD:**
- [ ] toggle active → vitrine 404 (conferir)
- [ ] reset senha exibe 1x
- [ ] anonimizar em 2 cliques via API-04

#### ADMIN-04 — Integração fim-a-fim
**Meta:** deps: ADMIN-03 · tam: S · refs: SPEC §1 · status: `todo`
**O quê:** Criar loja → logar com a senha provisória → painel funciona; loja inativa
→ 404 na vitrine.
**DoD:**
- [ ] fluxo completo manual passa
- [ ] loja inativa → 404 na vitrine

### M7 — Realtime + UX críticas

#### RT-01 — Realtime no Kanban
**Meta:** deps: PAINEL-03 · tam: S · refs: SPEC §4, §9, DS §3.1 · status: `todo`
**O quê:** Assinar `orders` filtrado por `store_id`; novo pedido/mudança re-renderiza
colunas; `aria-live="polite"` na região.
**DoD:**
- [ ] pedido criado pela API aparece sem reload
- [ ] `aria-live` presente

#### RT-02 — Som do painel
**Meta:** deps: RT-01 · tam: S · refs: SPEC §11, DS §6 · status: `todo`
**O quê:** Toque curtíssimo ≤150ms, disparado só após gesto do usuário dentro do painel
(desbloqueio de autoplay); nativo (`Audio`), sem lib.
**DoD:**
- [ ] som toca no novo pedido após interação
- [ ] nunca toca sem gesto
- [ ] duração ≤150ms

#### RT-03 — Favicon badge
**Meta:** deps: RT-01 · tam: S · refs: SPEC §11, DS §6 · status: `todo`
**O quê:** Canvas: número sobre fundo vermelho → `toDataURL` no `<link rel="icon">`,
refeito a cada mudança; `document.title` com o mesmo contador.
**DoD:**
- [ ] aba mostra badge com contagem correta
- [ ] 0 → sem badge

#### RT-04 — Fallback "Reconectando"
**Meta:** deps: RT-01 · tam: S · refs: SPEC §9, DS §6 · status: `todo`
**O quê:** Realtime caiu → indicador + polling 30s; tracking mantém polling 15s.
**DoD:**
- [ ] matar conexão mostra indicador
- [ ] kanban continua atualizando via polling

### M8 — Testes & CI

#### TEST-01 — Vitest unit
**Meta:** deps: M3+ · tam: M · refs: SPEC §10 · status: `todo`
**O quê:** `pricing` (subtotal, addons, taxa, mínimo sobre subtotal, troco,
arredondamento), `store-hours` (faixas, final inclusivo, meia-noite rejeitada,
`force_closed`), `order-status` (inclui `confirmed→preparing`), `cart`, `code`
(4 chars, alfabeto, unicidade diária), `wa`, `image` (funções puras).
**Arquivos:** `tests/unit/*.test.ts`
**DoD:**
- [ ] suite verde
- [ ] sem coverage gate, sem snapshot visual (SPEC §10)

#### TEST-02 — `tests/rls.sql`
**Meta:** deps: DB-04 · tam: M · refs: SPEC §10 · status: `todo`
**O quê:** As 9 asserções da SPEC §10 com a metodologia exata (`BEGIN`, `set local role`
dentro da transação, `claims` via `\set`, `raise 'FALHA'` FORA do `exception`,
`ROLLBACK` final).
**Arquivos:** `tests/rls.sql`
**DoD:**
- [ ] 9 asserções passam contra o DB migrado
- [ ] metodologia idêntica à SPEC §10

#### TEST-03 — `tests/orders-api.test.ts`
**Meta:** deps: API-01 · tam: M · refs: SPEC §10 · status: `todo`
**O quê:** Os 13 casos da SPEC §10: total adulterado ignorado; `price_changed`; dedup
409 sem token; rate limit 429; item indisponível 422 com nome; `force_closed` 409;
bairro não configurado 422; honeypot 400; abaixo do mínimo 422; pix sem troco;
`promised_at`/`ip_hash` gravados; CEP obrigatório 422; CEP 8 dígitos.
**Arquivos:** `tests/orders-api.test.ts`
**DoD:**
- [ ] 13 casos verdes

#### TEST-04 — Playwright
**Meta:** deps: WEB-06, PAINEL-04 · tam: M · refs: SPEC §10 · status: `todo`
**O quê:** 3 cenários (happy path, cancelamento cliente, rate limit), desktop + mobile
390×844.
**Arquivos:** `tests/e2e/*.spec.ts`
**DoD:**
- [ ] 3 cenários verdes em desktop e mobile

#### TEST-05 — CI
**Meta:** deps: TEST-01–04 · tam: S · refs: SPEC §9, §10 · status: `todo`
**O quê:** Um workflow: typecheck + lint + vitest + `db push` local + `rls.sql` +
testes de API + Playwright. **CI falha se `pg_publication_tables` não contiver `orders`**.
**Arquivos:** `.github/workflows/ci.yml`
**DoD:**
- [ ] CI verde no push
- [ ] CI falha sem `orders` na publication

#### TEST-06 — Bateria final (critério binário)
**Meta:** deps: todos · tam: M · refs: SPEC §1 · status: `todo`
**O quê:** Ensaio do dia inteiro: 1 loja real, ≥30 pedidos aceitos e entregues,
0 erro de checkout, 0 falha RLS.
**DoD:**
- [ ] critério da SPEC §1 **verdade**

---

## 3. Definition of Done global

Ver plano §8 — checklist final do projeto (9 itens). Uma task só marca `done` com o
DoD dela verdadeiro; o projeto só está pronto com o DoD global verdadeiro.

---

**Fim do Backlog v1.** Próxima etapa da esteira: **executar M1** (DB-01 → DB-06).
