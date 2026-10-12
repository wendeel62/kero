# Paridade admin v2 — KPIs, PDV/Mesas, Entregas, Financeiro, Rastreamento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as 6 capacidades restantes do admin do cardapio-digital no painel do kero — KPI de entregas em andamento, PDV com mesas, módulo de entregas com motoboy (sem mapa), financeiro (caixa + contas a pagar) e rastreamento (Pixel/GA4) — sem duplicatas, órfãos nem erros silenciosos.

**Architecture:** Toda lógica nova de leitura/cálculo vira função pura em `lib/`, testada com vitest sem banco; Server Actions só orquestram `requireStore()` + query + a função pura. Cinco migrations novas (`015`–`019`), cada uma criando tabela **e** RLS na mesma transação. PDV e Entregas ganham RPCs `security definer` próprios (fronteira de confiança diferente do checkout público). Nenhuma dependência nova.

**Tech Stack:** Next.js 15.1.6, React 19, Supabase (`@supabase/ssr`), Tailwind 4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-11-admin-parity-recon.md` (recon) + este plano. A resalva do dono sobre Financeiro está confirmada: o kero tem só a parte de análise de vendas em `app/painel/relatorios/`; **caixa e contas a pagar não existem** (grep em `app`/`lib`/`supabase` = zero). Este plano implementa exatamente o que falta.

## Global Constraints

- **Projeto Supabase deste repo: ref `ohcfnbaqorxcjmepsgct`.** O outro projeto da org (`lfypignjwfdrnuzlzhhv`) **não deve ser tocado**. Confirmar ref em `supabase/.temp/project-ref` antes de qualquer `db push`.
- Nenhuma dependência nova em `package.json`.
- Verificação de toda tarefa: `npm run test` (= `vitest run`) e, antes do commit, `npm run lint`.
- Testes são puros: **nenhum teste toca Supabase**.
- Fronteira de dia **sempre** America/Manaus, resolvida no servidor, via `manausDayStartISO` (`lib/painel-utils.ts:18`). Nunca no browser.
- Migration nova: `create table if not exists`, `alter table ... enable row level security`, `drop policy if exists` antes de `create policy`, `drop constraint if exists` antes de `add constraint`. **Nenhuma migration de correção** — série sequencial `NNN_nome.sql`.
- Última migration existente: `014_addon_groups_anon_read.sql`. As novas são `015`–`019`.
- Toda tabela nova tem policy `lojista_all` por `store_id = auth_store_id()` na mesma migration (modelo: `003_rls.sql:55-57`) e `store_id uuid not null references stores on delete cascade`.
- Mutações do painel passam por `mutate()` (`lib/painel-actions.ts:29`); leitura por `requireStore()` (`lib/auth.ts`). Copy de erro em PT-BR.
- **`npm run build` com o dev server de pé corrompe o `.next`** — mate o dev, rode o build, suba o dev de novo.
- **Dev server já de pé:** não suba outro (porta 3000 do cofre).
- **Verificação no browser é passo de tarefa**, não formalidade — pega valor sob rótulo errado e `onClick` em Server Component.

## Review Focus

Os modos de falha que as 6 features implicam e nenhum teste de tarefa cobre sozinho, mais prováveis primeiro. Cada um vira teste na tarefa dona do código:

1. **Pedido em mesa mudar de mesa / mesa ser reaberta com pedido ativo.** Duas mesas dividindo um pedido, ou a mesma mesa virando duas vezes. (dono: Task 2 — `activeTableOrder` + índice Task 1)
2. **Cancelamento de pedido com `reason` mas sem `canceled_by` (ou vice-versa) pelo PDV.** O trigger `fn_enforce_order_status_transition` (`002:187-194`) exige ambos. O PDV precisa chamar `set_order_status`, não UPDATE direto. (dono: Task 2)
3. **Financeiro em cima de pedidos cancelados.** Faturamento de caixa/resumo líquido inflado por pedido cancelado; cancelado não conta em nenhum total. (dono: Task 6)
4. **Pagar a mesma conta a pagar duas vezes, ou pagar valor maior que o devido.** `payable_account.paid` e `paid_cents` precisam ser idempotentes e nunca passar do valor. (dono: Task 6)
5. **Rastreamento: Pixel/GA4 vazando no browser antes da loja estar ativa, ou script duplicado.** IDs só entram na página se a loja `active`; um único ponto de injeção. (dono: Task 7)

## Notas de execução (valem para toda tarefa)

- **Travas do kero (recon §"Travas") que este plano atravessa de propósito:**
  - **Trava B** (`orders.type` só `delivery|pickup`, `001_schema.sql:97`): Task 1 adiciona `dine_in` com `alter table ... drop constraint ... add constraint`.
  - **Trava E** (UPDATE em `orders` restrito a 5 colunas, `003_rls.sql:96-97`): o PDV/entregas **não** fazem UPDATE direto em `orders`. Usam RPCs `security definer` (`assign_courier`, `pdv_create_order`) que validam e chamam `set_order_status` internamente — mesma via de escrita que o painel já usa.
  - **Trava A** (`ready→out` não existe): o assign de motoboy **só aceita pedido já em `out`** (decisão do recon:177-183). A máquina de estados não muda.
- **`orders.address` é nullable e `dine_in` deixa null** — o PDV de mesa não escreve endereço. `type='dine_in'` + `address=null` é o par consistente.
- **`create_order` (`002:309`) é `service_role` only** (`003_rls.sql:104`). O PDV **não** reusa `create_order`; ganha `pdv_create_order` próprio (Task 2), que ignora rate-limit/dedup de IP (ação humana do lojista, não checkout público) mas **mantém** recálculo de preço no servidor.
- **Realtime só publica `orders`** (`004_realtime_storage.sql:9`). Entregas/caixa não precisam de Realtime nesta leva — a tela recarrega na action (polling manual). Não alterar a publication.
- **Nomes de ícone:** `NavIcon` (`app/painel/shell.tsx:31-36`) só conhece `hoje`, `pedidos`, `cardapio`, `config`. Tasks novas reusam esses nomes; **não inventar ícone novo** (sem case novo, o item renderiza vazio).

---

### Task 1: Migration `015` — mesas (`dine_tables`) + tipo `dine_in`

**Files:**
- Create: `supabase/migrations/015_dine_in.sql`

**Interfaces:**
- Consomes: tabelas `stores`, `orders`.
- Produces:
  - tabela `dine_tables(id uuid, store_id uuid, number int not null, label text, active boolean)` com `unique(store_id, number)`, RLS `lojista_all`.
  - `orders.type` passa a aceitar `dine_in` (check constraint `orders_type_check`).
  - coluna `orders.table_id uuid references dine_tables on delete set null`.
  - Nenhuma outra tarefa cria mesas.

- [ ] **Step 1: Escrever a migration**

Conteúdo de `supabase/migrations/015_dine_in.sql`:

```sql
-- 015_dine_in.sql — mesas do salão + tipo de pedido 'dine_in' (recon §3, Trava B).
-- Mesa é só a entidade; o pedido em mesa continua sendo um orders com type='dine_in'.
create table if not exists dine_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  number integer not null check (number between 1 and 999),
  label text,
  active boolean not null default true,
  unique (store_id, number)
);

alter table dine_tables enable row level security;

drop policy if exists "lojista_all" on dine_tables;
create policy "lojista_all" on dine_tables
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

-- Trava B: orders.type ganha 'dine_in' (001_schema.sql:97 só tinha delivery|pickup)
alter table orders drop constraint if exists orders_type_check;
alter table orders add constraint orders_type_check
  check (type in ('delivery','pickup','dine_in'));

-- pedido em mesa: FK separada (001:97 não tem). on delete set null libera a mesa.
alter table orders add column if not exists table_id uuid;
alter table orders drop constraint if exists orders_table_id_fkey;
alter table orders add constraint orders_table_id_fkey
  foreign key (table_id) references dine_tables (id) on delete set null;

create index if not exists idx_dine_tables_store on dine_tables(store_id);
```

- [ ] **Step 2: Aplicar e verificar**

Run: `npx supabase db push`
Expected: `015_dine_in.sql` aplicada sem erro. Verificar pelo conector Supabase (somente leitura):

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='orders' and column_name in ('type','table_id');
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policies p where p.tablename=c.relname) as policies
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='dine_tables';
```

Expected: `dine_tables` com `relrowsecurity=true` e `policies=1`. `orders` tem `type` e `table_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/015_dine_in.sql
git commit -m "feat(db): dine_tables, coluna table_id e tipo dine_in em orders"
```

---

### Task 2: PDV — RPC `pdv_create_order` + mesa ocupada

**Files:**
- Create: `supabase/migrations/016_pdv.sql`
- Create: `lib/pdv.ts`
- Create: `lib/pdv.test.ts`
- Create: `app/painel/pdv/page.tsx`
- Modify: `lib/painel-actions.ts` (mutação `pdvCriarPedido`)
- Modify: `lib/painel.ts` (`getPdv`)
- Modify: `app/painel/shell.tsx:12-29` (nav item)

**Interfaces:**
- Consumes: `dine_tables` + `orders.type='dine_in'` + `orders.table_id` (Task 1); `set_order_status` (`002:261`).
- Produces:
  - RPC `pdv_create_order(p_store_id uuid, p_type text, p_table_id uuid, p_payment_method text, p_customer_name text, p_customer_phone text, p_items jsonb) returns jsonb` — `security definer`, `grant execute ... to authenticated` (lojista autenticado). Devolve `{"order_id": "...", "code": "...", "table_number": N}` ou levanta `MESA_JA_OCUPADA` / `MESA_INVALIDA` / `INVALID_TYPE`.
  - `type PdvLine = { id: string; qty: number; addons: string[]; notes?: string }`
  - `pdvTotal(items, products, addons): number` — puro; recalcula igual ao `create_order` (preço do produto + addons), clamp qty 1..20.
  - `activeTableOrder(tables, orders): (string | null)[]` — puro; para cada mesa, o status do pedido ativo (`new/confirmed/preparing/ready/out`) ou null.
  - `getPdv(): Promise<{ products: ...; addons: ...; tables: ...; activeByTable: ... }>`

- [ ] **Step 1: Escrever o teste que falha** (`lib/pdv.test.ts`)

```ts
import { test, expect } from "vitest";
import { pdvTotal, activeTableOrder } from "./pdv";

const products = [{ id: "p1", price_cents: 3000 }, { id: "p2", price_cents: 1500 }];
const addons = [{ id: "a1", price_cents: 400 }];

test("pdvTotal soma produto + adicionais, com clamp de qty 1..20", () => {
  const lines = [
    { id: "p1", qty: 2, addons: ["a1"] },   // (3000+400)*2 = 6800
    { id: "p2", qty: 1, addons: [] },        // 1500
    { id: "p1", qty: 0, addons: [] },        // clamp → 1 → 3000
  ];
  expect(pdvTotal(lines, products, addons)).toBe(6800 + 1500 + 3000);
});

test("pdvTotal ignora addon inexistente (não confia no client)", () => {
  expect(pdvTotal([{ id: "p1", qty: 1, addons: ["fantasma"] }], products, addons)).toBe(3000);
});

test("activeTableOrder: uma mesa ativa por pedido não finalizado", () => {
  const tables = ["t1", "t2", "t3"];
  const orders = [
    { table_id: "t1", status: "preparing" },
    { table_id: "t1", status: "delivered" },   // antigo, não conta
    { table_id: "t3", status: "cancelled" },
  ];
  expect(activeTableOrder(tables, orders)).toEqual(["preparing", null, null]);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/pdv.test.ts`
Expected: FAIL — `Failed to resolve import "./pdv"`.

- [ ] **Step 3: Implementar `lib/pdv.ts`**

```ts
// PDV (recon §3): recálculo de preço no servidor, idêntico ao create_order.
// Mesa ativa = pedido não finalizado (new/confirmed/preparing/ready/out).
export type PdvLine = { id: string; qty: number; addons: string[]; notes?: string };

const NAO_FINALIZADOS = ["new", "confirmed", "preparing", "ready", "out"];

export function pdvTotal(
  lines: PdvLine[],
  products: { id: string; price_cents: number }[],
  addons: { id: string; price_cents: number }[]
): number {
  const price = new Map(products.map((p) => [p.id, p.price_cents]));
  const add = new Map(addons.map((a) => [a.id, a.price_cents]));
  let total = 0;
  for (const l of lines) {
    const base = price.get(l.id);
    if (base === undefined) continue;                 // produto inexistente: ignora
    const unit = base + l.addons.reduce((s, id) => s + (add.get(id) ?? 0), 0);
    total += unit * Math.min(Math.max(l.qty || 1, 1), 20);   // clamp 1..20
  }
  return total;
}

// para cada mesa, o status do pedido ativo (ou null). Uma mesa com pedido
// finalizado/cancelado fica livre.
export function activeTableOrder(
  tables: string[],
  orders: { table_id: string | null; status: string }[]
): (string | null)[] {
  const ativos = new Map<string, string>();
  for (const o of orders) {
    if (o.table_id && NAO_FINALIZADOS.includes(o.status)) ativos.set(o.table_id, o.status);
  }
  return tables.map((t) => ativos.get(t) ?? null);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run lib/pdv.test.ts`
Expected: PASS — 3 testes.

- [ ] **Step 5: Migration `016` — RPC `pdv_create_order`**

`supabase/migrations/016_pdv.sql`: RPC `security definer set search_path = public` que:
- valida `p_type in ('dine_in','pickup','delivery')` (senão `INVALID_TYPE`);
- valida loja ativa (senão `STORE_INACTIVE`);
- se `p_type='dine_in'`: exige `p_table_id`, valida que a mesa existe e é da loja (`MESA_INVALIDA`), e que **não** existe pedido não finalizado naquela mesa (`MESA_JA_OCUPADA`);
- recalcula preço produto+addons no servidor (loop sobre `p_items`, mesma lógica de `create_order`, clamp qty 1..20) — nunca confia em total do client;
- insere `orders` com `status='new'`, `address=null`, `payment_method=p_payment_method`, `p_type`, `table_id=p_table_id`, `change_for_cents=null`;
- gera `code` único por loja/dia (reaproveitar `fn_random_code()`, retry em `unique_violation`);
- registra `order_events` inicial `to_status='new'`, `actor='store'`;
- `grant execute on function pdv_create_order(uuid, text, uuid, text, text, text, jsonb) to authenticated;`

Corpo: copiar o padrão de insert de `create_order` (`002:490-519`) — **mesma forma de código/evento**, sem rate-limit/dedup de IP (ação humana, não checkout público).

- [ ] **Step 6: Aplicar e verificar a trava de mesa ocupada**

Run: `npx supabase db push`
Expected: `016_pdv.sql` aplicada. Verificar pelo conector (read-only) que a função existe. Provar `MESA_JA_OCUPADA` por canal de escrita (SQL Editor/psql): criar pedido na mesa 1, tentar segundo → `ERROR: MESA_JA_OCUPADA`.

- [ ] **Step 7: Action `pdvCriarPedido` + leitura `getPdv`**

Em `lib/painel-actions.ts`: `pdvCriarPedido(input)` chama o RPC via `mutate("/painel/pdv", ...)`, traduz `MESA_JA_OCUPADA` → "Essa mesa já tem um pedido em aberto." e `MESA_INVALIDA` → "Mesa inválida." em PT-BR. Em `lib/painel.ts`: `getPdv()` traz products ativos, addons, dine_tables da loja e os pedidos não finalizados com `table_id`, devolvendo `activeByTable` via `activeTableOrder`.

- [ ] **Step 8: Página `app/painel/pdv/page.tsx`**

Client Component: escolher tipo (Mesa/Retirada), se Mesa escolher a mesa (badge "ocupada"/"livre" via `activeByTable`), montar carrinho (produtos + addons), mostrar total com `pdvTotal`, chamar `pdvCriarPedido`. Em `app/painel/shell.tsx` adicionar `{ href: "/painel/pdv", label: "PDV", icon: "pedidos" }` ao grupo "Operação".

- [ ] **Step 9: Verificar no browser + suíte**

Run: `npm run test && npm run lint`, depois `npm run dev` e abrir `http://localhost:3000/painel/pdv`.
Expected: criar pedido em mesa livre funciona; tentar na mesma mesa de novo mostra erro e não duplica; o pedido aparece no kanban.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/016_pdv.sql lib/pdv.ts lib/pdv.test.ts app/painel/pdv/page.tsx lib/painel-actions.ts lib/painel.ts app/painel/shell.tsx
git commit -m "feat(painel): PDV com mesas e trava de mesa ocupada"
```

---

### Task 3: Mesas do salão nas Configurações

**Files:**
- Modify: `lib/painel-actions.ts` (CRUD `dine_tables`)
- Modify: `lib/painel.ts` (`getConfiguracoes` traz mesas) e `lib/painel-utils.ts`
- Modify: `app/painel/configuracoes/page.tsx` (aba "Salão")

**Interfaces:**
- Consomes: `dine_tables` (Task 1); `PanelSettings` (`lib/painel-utils.ts:75`).
- Produces:
  - `saveTables(tables: {id?, number, label, active}[]): Promise<R>` em `painel-actions.ts`
  - `deleteTable(id): Promise<R>`
  - `PanelSettings` ganha `tables: { id: string; number: number; label: string; active: boolean }[]`

- [ ] **Step 1: Mutação `saveTables`/`deleteTable`**

Em `lib/painel-actions.ts`, padrão de `saveEntrega` (`:294-335`): insert novas (`number` 1..999, senão "Número da mesa: 1 a 999."), update existentes por `id`+`store_id`, delete por `deletedIds`. Ação de UI: `deleteTable` só permitida quando não há pedido ativo na mesa (a UI desabilita o botão; o banco com `on delete set null` é o backstop).

- [ ] **Step 2: `getConfiguracoes` traz as mesas**

Em `lib/painel.ts`, adicionar `dine_tables` ao select de configurações e incluir em `PanelSettings`.

- [ ] **Step 3: Aba "Salão" em `app/painel/configuracoes/page.tsx`**

Editor de mesas (número, label, ativa) no mesmo padrão da aba "Entrega" (lista + adicionar + remover). Reusa os botões de aba existentes — sem aba nova além de "Salão".

- [ ] **Step 4: Rodar suíte, lint e verificar**

Run: `npm run test && npm run lint`, depois browser em `http://localhost:3000/painel/configuracoes` aba "Salão".
Expected: criar 5 mesas, recarregar e persistir; mesa com pedido ativo não pode ser excluída (botão desabilitado + motivo visível).

- [ ] **Step 5: Commit**

```bash
git add lib/painel-actions.ts lib/painel.ts lib/painel-utils.ts app/painel/configuracoes/page.tsx
git commit -m "feat(painel): mesas do salao nas configuracoes"
```

---

### Task 4: KPI — entregas em andamento

**Files:**
- Create: `lib/kpis.ts`
- Create: `lib/kpis.test.ts`
- Modify: `lib/painel.ts` (`getHoje` ganha `entregasAndamento`)
- Modify: `app/painel/page.tsx` (cartão)

**Interfaces:**
- Consomes: `PanelRow[]` (já buscado por `getHoje`, `lib/painel.ts:30`).
- Produces:
  - `entregasEmAndamento(orders: { status: string }[]): number` — count `status in [preparing, ready, out]`
  - `getHoje` devolve `stats.entregasAndamento`

- [ ] **Step 1: Teste que falha** (`lib/kpis.test.ts`)

```ts
import { test, expect } from "vitest";
import { entregasEmAndamento } from "./kpis";

test("conta só preparing/ready/out — exclui new, delivered e cancelled", () => {
  const orders = [
    { status: "new" }, { status: "preparing" }, { status: "ready" },
    { status: "out" }, { status: "delivered" }, { status: "cancelled" },
    { status: "preparing" },
  ];
  expect(entregasEmAndamento(orders)).toBe(3);
});
```

- [ ] **Step 2: Rodar e confirmar FAIL**, **Step 3: implementar**

```ts
// KPI entregas em andamento (recon §1): preparing + ready + out.
export function entregasEmAndamento(orders: { status: string }[]): number {
  return orders.filter((o) => o.status === "preparing" || o.status === "ready" || o.status === "out").length;
}
```

- [ ] **Step 4: Rodar e confirmar PASS.** **Step 5: ligar em `getHoje`**

Em `lib/painel.ts`, `getHoje` já tem `orders` em memória — acrescentar `entregasAndamento: entregasEmAndamento(orders)` em `stats` (`:37-41`), e renderizar o cartão em `app/painel/page.tsx` (mesmo estilo dos cartões existentes, rótulo "Entregas em andamento").

- [ ] **Step 6: Rodar suíte + lint + browser, commit**

```bash
git add lib/kpis.ts lib/kpis.test.ts lib/painel.ts app/painel/page.tsx
git commit -m "feat(painel): KPI de entregas em andamento"
```

---

### Task 5: Entregas + motoboy (sem mapa)

**Files:**
- Create: `supabase/migrations/017_deliveries.sql`
- Create: `lib/deliveries.ts`
- Create: `lib/deliveries.test.ts`
- Create: `app/painel/entregas/page.tsx`
- Modify: `lib/painel-actions.ts` (mutação de courier/assign)
- Modify: `lib/painel.ts` (`getEntregas`)
- Modify: `app/painel/shell.tsx` (nav item)

**Interfaces:**
- Consomes: `set_order_status` (`002:261`) — única via de transição; `orders`/`order_events`.
- Produces:
  - tabelas `couriers(id, store_id, name, phone, active)` e `routes(id, store_id, courier_id, status, created_at)` + `route_stops(id, route_id, order_id, seq, delivered_at)`, todas com RLS `lojista_all`.
  - RPC `assign_courier(p_order_id uuid, p_courier_id uuid) returns uuid` — `security definer`, valida courier ativo da loja, **não já em rota** (`COURIER_EM_ROTA`), pedido em `out` (Trava A), e cria `route`+`route_stop` chamando `set_order_status(order,'out',...)`. `grant execute ... to authenticated`.
  - `type Courier = { id: string; name: string; phone: string; active: boolean }`
  - `courierOnRoute(couriers, routes): Set<string>` — puro; ids de courier com rota aberta (`status='open'`).
  - `boardColumns(orders): { prontas, emRota, concluidas }` — puro; prontas=`ready`, emRota=`out`, concluídas=`delivered` do dia.

- [ ] **Step 1: Teste que falha** (`lib/deliveries.test.ts`)

```ts
import { test, expect } from "vitest";
import { courierOnRoute, boardColumns } from "./deliveries";

test("courierOnRoute: só courier com rota aberta (open)", () => {
  const couriers = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
  const routes = [
    { courier_id: "c1", status: "open" },
    { courier_id: "c2", status: "closed" },
  ];
  expect([...courierOnRoute(couriers, routes)]).toEqual(["c1"]);
});

test("boardColumns separa prontas / em rota / concluídas", () => {
  const orders = [
    { status: "ready" }, { status: "out" }, { status: "delivered" },
    { status: "preparing" }, { status: "cancelled" },
  ];
  const c = boardColumns(orders);
  expect(c.prontas).toBe(1);
  expect(c.emRota).toBe(1);
  expect(c.concluidas).toBe(1);
});
```

- [ ] **Step 2: Rodar e confirmar FAIL. Step 3: implementar `lib/deliveries.ts`**

```ts
// Entregas (recon §4, sem mapa): prontas, em rota, concluídas hoje.
// Motoboy "em rota" = rota aberta; assign reusa set_order_status (Trava A).
export type Courier = { id: string; name: string; phone: string; active: boolean };

export function courierOnRoute(
  couriers: { id: string }[],
  routes: { courier_id: string; status: string }[]
): Set<string> {
  const abertas = new Set(routes.filter((r) => r.status === "open").map((r) => r.courier_id));
  return new Set(couriers.filter((c) => abertas.has(c.id)).map((c) => c.id));
}

export function boardColumns(orders: { status: string }[]): { prontas: number; emRota: number; concluidas: number } {
  const f = (s: string) => orders.filter((o) => o.status === s).length;
  return { prontas: f("ready"), emRota: f("out"), concluidas: f("delivered") };
}
```

- [ ] **Step 4: Rodar e confirmar PASS. Step 5: Migration `017`**

`supabase/migrations/017_deliveries.sql`: criar `couriers`, `routes(status check in ('open','closed'))`, `route_stops(unique(route_id, order_id))`, todas com RLS `lojista_all` por `store_id`; `route_stops` com policy derivada (via `routes`→`store_id`). RPC `assign_courier` `security definer`:
- valida pedido da loja e `status='out'` (`ORDER_NOT_READY`);
- valida courier ativo da loja (`COURIER_INVALID`);
- se courier tem rota `open` → `COURIER_EM_ROTA`;
- cria `route` (se courier não tem rota aberta) + `route_stop`, e chama `set_order_status(p_order_id, 'out', null, 'store')`.
- `grant execute ... to authenticated`.

- [ ] **Step 6: Aplicar e verificar**

Run: `npx supabase db push`. Verificar pelo conector (read-only) tabelas/RLS; provar `COURIER_EM_ROTA` por canal de escrita (SQL Editor/psql): assign o mesmo courier a dois pedidos `out` → segundo levanta `COURIER_EM_ROTA`.

- [ ] **Step 7: Leitura + mutação + página**

`getEntregas()` em `lib/painel.ts` (prontas/emRota/concluídas + couriers com `courierOnRoute`); `assignEntrega(orderId, courierId)` em `painel-actions.ts` (traduz `COURIER_EM_ROTA` → "Esse motoboy já está em rota."); página `app/painel/entregas/page.tsx` (3 colunas, botão "Atribuir motoboy" só em pedido `out`, lista de couriers ativos). Nav item `{ href: "/painel/entregas", label: "Entregas", icon: "pedidos" }` em "Operação".

- [ ] **Step 8: Suíte + lint + browser, commit**

```bash
git add supabase/migrations/017_deliveries.sql lib/deliveries.ts lib/deliveries.test.ts app/painel/entregas/page.tsx lib/painel-actions.ts lib/painel.ts app/painel/shell.tsx
git commit -m "feat(painel): entregas com motoboy, sem mapa"
```

---

### Task 6: Financeiro — caixa + contas a pagar (completo)

**Files:**
- Create: `supabase/migrations/018_finance.sql`
- Create: `lib/finance.ts`
- Create: `lib/finance.test.ts`
- Create: `app/painel/financeiro/page.tsx`
- Modify: `lib/painel-actions.ts` (mutações)
- Modify: `lib/painel.ts` (`getFinanceiro`)
- Modify: `app/painel/shell.tsx` (nav item)

**Interfaces:**
- Consomes: `resolvePeriod`/`parsePeriodKind` (plano v1, `lib/period.ts`); `orders.total_cents`, `status`.
- Produces:
  - tabelas `cash_sessions(id, store_id, opened_at, closed_at, opening_cents, closing_cents)`, `cash_movements(id, store_id, session_id, direction check in ('in','out'), amount_cents, note, created_at)`, `payable_accounts(id, store_id, description, amount_cents, due_date, paid, paid_at, paid_cents)`, todas RLS `lojista_all`.
  - `type CashMovement = { direction: "in" | "out"; amount_cents: number; note: string }`
  - `cashSummary(session, movements, salesCents): { entradas, saidas, saldo, expected, diff }` — puro; `salesCents` = faturamento válido do dia (exclui cancelados). `expected = opening + entradas − saidas`; `diff = closing − expected` (só fecha se `closing` informado).
  - `payableStatus(account, todayISO): "pendente" | "atrasada" | "paga"` — puro; atrasada se `!paid && due_date < today`; paga se `paid`.
  - `netRevenue(revenueCents, paidExpensesCents): number` — `revenue − despesas pagas no período`.

- [ ] **Step 1: Teste que falha** (`lib/finance.test.ts`)

```ts
import { test, expect } from "vitest";
import { cashSummary, payableStatus, netRevenue } from "./finance";

test("cashSummary: saldo = abertura + entradas - saidas; diff = contado - esperado", () => {
  const session = { opening_cents: 10000, closing_cents: 25000 };
  const movements = [
    { direction: "in", amount_cents: 20000, note: "" },
    { direction: "out", amount_cents: 5000, note: "troco" },
  ];
  const s = cashSummary(session, movements, 0);
  expect(s.entradas).toBe(20000);
  expect(s.saidas).toBe(5000);
  expect(s.saldo).toBe(25000);        // 10000+20000-5000
  expect(s.expected).toBe(25000);
  expect(s.diff).toBe(0);
});

test("cashSummary: caixa aberto (sem closing) tem diff null", () => {
  const s = cashSummary({ opening_cents: 0, closing_cents: null }, [], 0);
  expect(s.diff).toBeNull();
});

test("payableStatus: atrasada só quando não paga e vencida", () => {
  const hoje = "2026-10-11";
  expect(payableStatus({ paid: false, due_date: "2026-10-01" }, hoje)).toBe("atrasada");
  expect(payableStatus({ paid: false, due_date: "2026-10-20" }, hoje)).toBe("pendente");
  expect(payableStatus({ paid: true, due_date: "2026-10-01" }, hoje)).toBe("paga");
});

test("netRevenue: liquido = bruto - despesas pagas", () => {
  expect(netRevenue(50000, 20000)).toBe(30000);
});

test("cashSummary: faturamento do dia entra como entrada implícita no esperado", () => {
  const s = cashSummary({ opening_cents: 0, closing_cents: 30000 }, [], 30000);
  expect(s.expected).toBe(30000);     // abertura + vendas do dia
});
```

- [ ] **Step 2: Rodar e confirmar FAIL. Step 3: implementar `lib/finance.ts`**

```ts
// Financeiro (recon §5): caixa + contas a pagar. "Líquido" = bruto − despesas
// PAGAS no período (não há custo de produto em nenhum dos dois projetos).
export type CashMovement = { direction: "in" | "out"; amount_cents: number; note: string };

export function cashSummary(
  session: { opening_cents: number; closing_cents: number | null },
  movements: CashMovement[],
  salesCents: number
): { entradas: number; saidas: number; saldo: number; expected: number; diff: number | null } {
  const entradas = movements.filter((m) => m.direction === "in").reduce((s, m) => s + m.amount_cents, 0);
  const saidas = movements.filter((m) => m.direction === "out").reduce((s, m) => s + m.amount_cents, 0);
  const saldo = session.opening_cents + entradas - saidas;
  const expected = saldo + salesCents;
  const diff = session.closing_cents === null ? null : session.closing_cents - expected;
  return { entradas, saidas, saldo, expected, diff };
}

export function payableStatus(
  account: { paid: boolean; due_date: string },
  todayISO: string
): "pendente" | "atrasada" | "paga" {
  if (account.paid) return "paga";
  return account.due_date < todayISO ? "atrasada" : "pendente";
}

export function netRevenue(revenueCents: number, paidExpensesCents: number): number {
  return revenueCents - paidExpensesCents;
}
```

- [ ] **Step 4: Rodar e confirmar PASS. Step 5: Migration `018`**

`supabase/migrations/018_finance.sql`: criar `cash_sessions`, `cash_movements` (FK para session, `on delete cascade`), `payable_accounts`, todas `enable row level security` + `lojista_all` por `store_id`. Constraints: `direction in ('in','out')`, `amount_cents > 0`, `opening_cents >= 0`. **Regra de um caixa aberto por loja:** índice parcial único `unique (store_id) where closed_at is null`.

- [ ] **Step 6: Aplicar e verificar**

Run: `npx supabase db push`. Verificar tabelas/RLS pelo conector (read-only). Provar a trava de caixa único por canal de escrita (SQL Editor/psql): abrir dois caixas → segundo levanta unique violation.

- [ ] **Step 7: Ações — abrir/movimento/fechar + contas**

`lib/painel-actions.ts`: `abrirCaixa(openingCents)`, `movimentoCaixa(direction, amount, note)`, `fecharCaixa(closingCents)` (grava `closing_cents`, `closed_at`), `pagarConta(id, paidCents)` (idempotente: se já `paid` retorna ok sem reescrever; `paid_cents <= amount_cents`, senão "Valor pago não pode passar do devido."), `saveConta(...)`/`deleteConta(id)`. Todos via `mutate()`. `lib/painel.ts`: `getFinanceiro(period)` — faturamento válido do período (exclui cancelados, mesma query de `getRelatorios`), sessão de caixa aberta + movimentos, contas com `payableStatus`, e `netRevenue`.

- [ ] **Step 8: Página `app/painel/financeiro/page.tsx`**

Três blocos: (a) resumo do período — bruto, despesas pagas, **líquido** (`netRevenue`); série já coberta por Relatórios (não duplicar gráfico); (b) **Caixa** — abrir (fundo inicial), lançar entrada/saída, fechar com valor contado mostrando `diff` ("faltou R$ X" / "sobrou R$ Y"); (c) **Contas a pagar** — CRUD + botão "Pagar" (com campo de valor pago), status `payableStatus` em badge. Nav item `{ href: "/painel/financeiro", label: "Financeiro", icon: "hoje" }` em "Gestão".

- [ ] **Step 9: Suíte + lint + browser, commit**

```bash
git add supabase/migrations/018_finance.sql lib/finance.ts lib/finance.test.ts app/painel/financeiro/page.tsx lib/painel-actions.ts lib/painel.ts app/painel/shell.tsx
git commit -m "feat(painel): financeiro com caixa e contas a pagar"
```

---

### Task 7: Rastreamento (Pixel/GA4) — tabela `store_tracking`

**Files:**
- Create: `supabase/migrations/019_store_tracking.sql`
- Create: `lib/tracking.ts`
- Create: `lib/tracking.test.ts`
- Create: `components/tracking-scripts.tsx`
- Modify: `lib/painel.ts` (`getConfiguracoes` traz tracking) e `lib/painel-utils.ts`
- Modify: `lib/painel-actions.ts` (`saveTracking`)
- Modify: `app/painel/configuracoes/page.tsx` (aba "Rastreamento")
- Modify: vitrine (`app/[slug]/layout.tsx`) — injeção única

**Interfaces:**
- Consomes: `stores.active` (só injeta em loja ativa); leitura anon da vitrine.
- Produces:
  - tabela `store_tracking(store_id uuid pk, fb_pixel_id text, ga4_id text)` com RLS: `anon_select` quando a loja está `active` (igual `003_rls.sql:27-28`) + `lojista_all` escrita.
  - `trackingEnabled(pixel, ga4): boolean` — puro; true se algum id válido.
  - `sanitizeTrackingId(kind, raw): string | null` — puro; FB pixel = 10–20 dígitos; GA4 = `G-XXXXXXXXXX`; lixo/inválido → null (nunca injeta script com id quebrado).

- [ ] **Step 1: Teste que falha** (`lib/tracking.test.ts`)

```ts
import { test, expect } from "vitest";
import { sanitizeTrackingId, trackingEnabled } from "./tracking";

test("sanitizeTrackingId: pixel FB só aceita dígitos 10-20", () => {
  expect(sanitizeTrackingId("pixel", "1234567890123")).toBe("1234567890123");
  expect(sanitizeTrackingId("pixel", "123")).toBeNull();
  expect(sanitizeTrackingId("pixel", "abc12345678901")).toBeNull();
  expect(sanitizeTrackingId("pixel", "")).toBeNull();
});

test("sanitizeTrackingId: GA4 só aceita G- + alfanumérico", () => {
  expect(sanitizeTrackingId("ga4", "G-ABC123")).toBe("G-ABC123");
  expect(sanitizeTrackingId("ga4", "UA-123")).toBeNull();
  expect(sanitizeTrackingId("ga4", "G-")).toBeNull();
});

test("trackingEnabled: só com algum id válido", () => {
  expect(trackingEnabled("1234567890123", null)).toBe(true);
  expect(trackingEnabled(null, "G-ABC")).toBe(true);
  expect(trackingEnabled(null, null)).toBe(false);
});
```

- [ ] **Step 2: Rodar e confirmar FAIL. Step 3: implementar `lib/tracking.ts`**

```ts
// Rastreamento (recon §8): ids validados antes de injetar script. Id inválido
// nunca vira <script> — evita pixel quebrado poluindo o console da vitrine.
export function sanitizeTrackingId(kind: "pixel" | "ga4", raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (kind === "pixel") return /^[0-9]{10,20}$/.test(v) ? v : null;
  return /^G-[A-Z0-9]{4,12}$/.test(v) ? v : null;
}

export function trackingEnabled(pixel: string | null, ga4: string | null): boolean {
  return pixel !== null || ga4 !== null;
}
```

- [ ] **Step 4: Rodar e confirmar PASS. Step 5: Migration `019`**

`supabase/migrations/019_store_tracking.sql`: `create table store_tracking (store_id uuid primary key references stores on delete cascade, fb_pixel_id text, ga4_id text)`; `enable row level security`; `anon_select` com `exists (stores active)` (o pixel do cliente roda como anon na vitrine); `lojista_all` para escrita do lojista.

- [ ] **Step 6: Aplicar e verificar**

Run: `npx supabase db push`. Verificar pelo conector que `anon_select` só retorna linha de loja ativa (loja inativa = null, sem script).

- [ ] **Step 7: `saveTracking` + leitura + aba**

`saveTracking(fb_pixel_id, ga4_id)` em `painel-actions.ts` (valida com `sanitizeTrackingId`, id inválido → "Pixel/GA4 inválido."; upsert em `store_tracking`). `getConfiguracoes` traz os ids. Aba "Rastreamento" em configurações com os dois campos.

- [ ] **Step 8: Injeção única**

`components/tracking-scripts.tsx`: Server Component que lê o tracking da loja (anon) e, **só se `active` e id válido**, renderiza os `<script>` de FB Pixel e GA4 via `next/script`. Um único ponto de injeção na vitrine (`app/[slug]/layout.tsx`) — **não** espalhar script por página (Review Focus #5: script duplicado).

- [ ] **Step 9: Suíte + lint + browser, commit**

```bash
git add supabase/migrations/019_store_tracking.sql lib/tracking.ts lib/tracking.test.ts components/tracking-scripts.tsx lib/painel.ts lib/painel-utils.ts lib/painel-actions.ts app/painel/configuracoes/page.tsx "app/[slug]/layout.tsx"
git commit -m "feat: rastreamento pixel/ga4 por loja"
```

---

## Self-Review

**1. Cobertura das 6 features.** KPIs extra → Task 4. Financeiro → Task 6 (completo: caixa+contas+líquido, como decidido). PDV+mesas → Tasks 1,2,3 (schema, RPC+UI, config mesas). Entregas+motoboy (sem mapa) → Task 5. Rastreamento → Task 7 (tabela `store_tracking`, como decidido). Mesas/salão nas config → Task 3. Sobreposição PDV/config-mesas fundida na mesma migration 015, como combinado.

**2. Review Focus.** #1 (mesa reaberta) → Task 1 (schema) + teste `activeTableOrder` (Task 2). #2 (cancel pelo PDV) → PDV não faz UPDATE direto; RPC `security definer` (Task 2). #3 (cancelado no financeiro) → `netRevenue`/faturamento exclui cancelados (Task 6, teste). #4 (pagar duas vezes / pagar a mais) → idempotência + `paid_cents <= amount_cents` (Task 6). #5 (pixel duplicado/quebrado) → injeção única (Task 7) + `sanitizeTrackingId` (teste).

**3. Consistência de tipos.** `PanelSettings.tables` (Task 3) consumido pelo PDV (Task 2) e entregas não toca. `orders.type='dine_in'` definido em Task 1, usado em Task 2. `courierOnRoute`/`boardColumns` definidos em Task 5 e só ali usados.

**4. Proporção.** 7 tasks, 5 migrations. Corpos de código só onde a assinatura e o teste não determinam (RPCs, funções puras com aritmética de dinheiro). Nenhum corpo de UI escrito — só responsabilidade de tela.
