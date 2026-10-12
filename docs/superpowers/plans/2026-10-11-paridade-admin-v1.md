# Paridade com o admin do cardapio-digital — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer seis capacidades do admin do cardapio-digital para o painel do kero (período, tempo no status, filtros do kanban, clientes com perfil, meta, complementos com grupos) sem introduzir duplicatas, órfãos ou erros silenciosos.

**Architecture:** Toda lógica nova de leitura vira função pura em `lib/`, testada com `vitest` sem banco; as Server Actions só orquestram `requireStore()` + query + essa função pura. Duas migrations novas (`010`, `011`), cada uma criando a tabela **e** a RLS na mesma transação. Nenhuma dependência nova.

**Tech Stack:** Next.js 15.1.6, React 19, Supabase (`@supabase/ssr`), Tailwind 4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-11-paridade-admin-design.md`

## Global Constraints

- **Projeto Supabase deste repo: ref `ohcfnbaqorxcjmepsgct`** (nome no painel: `cardapio-digital-kero-delivery` — o nome engana, o ref não). O outro projeto da org, `lfypignjwfdrnuzlzhhv` (nome `cardapio kero`), pertence ao repo `cardapio-digital` e **não deve ser tocado por este plano**. Confirmar o ref contra `supabase/.temp/project-ref` e o host em `.env.local` antes de qualquer `db push`.
- Nenhuma dependência nova em `package.json`.
- Verificação de toda tarefa: `npm run test` (que é `vitest run`) e, antes do commit, `npm run lint`.
- Testes são puros: **nenhum teste toca Supabase** (`vitest.config.ts` não tem setup de banco).
- Fronteira de dia **sempre** America/Manaus, resolvida no servidor, via `manausDayStartISO` (`lib/painel-utils.ts:17`). Nunca no browser.
- Migration nova: `create table if not exists`, `alter table ... enable row level security`, `drop policy if exists` antes de `create policy`, e `drop constraint if exists` antes de `add constraint`.
- Nenhuma tabela nova sem policy `lojista_all` por `store_id = auth_store_id()` na mesma migration (modelo: `supabase/migrations/003_rls.sql:55-57`).
- Toda tabela nova tem `store_id uuid not null references stores on delete cascade`.
- Última migration existente: `010_storefront_texts.sql` (recuperada na Tarefa 0). As novas são `011_sales_goals.sql`, `012_addon_groups.sql` e `013_addon_group_enforcement.sql`. Numeração sequencial `NNN_nome.sql`, continuando a série existente — **nenhuma migration de correção**: o arquivo `010` é o original recuperado do banco, não um remendo.
- **`db push` está bloqueado** até a Tarefa 0 (reconciliação do histórico) ser concluída: o remoto tem 10 migrations registradas com versão em timestamp e o CLI recusa com `DbPushMissingLocalError`. A Tarefa 0 roda primeiro, sempre.
- Nenhuma migration desta v1 usa `alter table` em tabela existente além do que a Tarefa 6 declara; nada de recriar `create_order` fora da Tarefa 9.
- Mutações do painel passam por `mutate()` (`lib/painel-actions.ts:28`); leitura por `requireStore()` (`lib/auth.ts`).
- Copy de erro em PT-BR: mensagem nova entra em `lib/api-errors.ts` (`TABLE` ou `STATUS_TABLE`), nunca solta numa rota.
- `period` é `'daily' | 'weekly' | 'monthly'` — sem acento, sem variante (o cardapio tinha duas famílias de string; aqui é uma só).

## Notas de execução (valem para toda tarefa)

- **Nomes de ícone:** `NavIcon` (`app/painel/shell.tsx`) só conhece `hoje`, `pedidos`, `cardapio`, `config`. Tarefa 4 e 5 reusam esses nomes; **não inventar ícone novo** — sem case novo no `NavIcon`, o item renderiza vazio.
- **`getAwaitingCount` continua "hoje".** Alimenta o badge da sidebar (`shell.tsx:173`), que é sobre agora, não sobre o período escolhido. Não passar o filtro para ele.
- **Canal de escrita:** o conector Supabase (`RUN_READ_ONLY_QUERY`) é somente leitura — serve para **verificar**, não para aplicar. Aplicar migration é `npx supabase db push`; os passos que **provam uma rejeição** (Tarefa 6 passo 4, Tarefa 9 passo 6) precisam de canal de escrita e não podem usar o conector: usar o SQL Editor do painel Supabase ou `psql` com a connection string do pooler. Uma rejeição não deixa linha para trás, então não há limpeza a fazer.
- **`npm run build` com o dev server de pé corrompe o `.next`.** Os dois escrevem no
  mesmo diretório: o build sobrescreve o que o dev server está servindo, e o dev passa a
  responder `500` com `MODULE_NOT_FOUND` em `.next/server/...`. Se precisar rodar os
  dois, **mate o dev server, rode o build, e suba o dev de novo** (apagando `.next` se
  já corrompeu). Sintoma: `/login` responde 500 e a página renderiza em branco.
- **Dev server já de pé:** não suba outro. Se a porta 3000 estiver ocupada, o Next sobe
  na 3001 e o login salvo no cofre (bound a `localhost:3000`) não preenche — a
  verificação no browser falha por ambiente, não por código.
- **Verificação no browser é passo de tarefa, não formalidade.** Ela pega uma classe de
  defeito que nenhuma revisão de diff encontra: valor certo sob rótulo que o contradiz,
  controle que não faz nada, `onClick` em Server Component que só explode no clique. Nas
  Tarefas 2, 4 e 5 foi ela que provou (ou derrubou) o resultado.

## Review Focus

Os cinco modos de falha que a spec implica e nenhum teste de tarefa cobre sozinho, mais prováveis primeiro. Cada um vira teste na tarefa que é dona do código:

1. **Virada de meia-noite em Manaus durante o turno.** Um operador olhando "hoje" às 23:59 e às 00:01 deve ver o contador voltar a zero, e o pedido de 23:58 não pode aparecer em "ontem" nem sumir. (dono: Tarefa 2)
2. **Loja sem meta cadastrada.** `progresso` não pode dividir por zero, nem mostrar 100%, nem 0%: sem meta, a tela não mostra o bloco. (dono: Tarefa 5)
3. **Grupo obrigatório sem nenhuma opção ativa.** Um grupo `required=true` cujo único adicional foi desativado não pode impedir a venda daquele produto — a obrigatoriedade só vale se o grupo tem opção aplicável. (dono: Tarefa 9)
4. **Cliente com o mesmo telefone em pedidos cancelados.** Cancelado não conta no perfil nem no total gasto, e um cliente só de cancelados é "novo" com 0 pedidos — nunca VIP. (dono: Tarefa 4)
5. **Período custom com data invertida ou lixo.** `from` depois de `to`, ou string que não é `YYYY-MM-DD`, não pode devolver intervalo vazio em silêncio nem estourar: cai no default com o motivo visível. (dono: Tarefa 2)

---

### Task 0: Reconciliar o histórico de migrations (bloqueia todas as outras)

**Auditado em 2026-10-11 contra o projeto `ohcfnbaqorxcjmepsgct`** (via conector Supabase,
somente leitura). O remoto tem **10 migrations registradas** com o `version` em
timestamp e nome descritivo (`001_schema` … `010_storefront_texts`); o repositório usa
`NNN_nome.sql`. Nove delas são exatamente as `001`–`009` do repo — só o formato do
`version` difere. A décima, **`010_storefront_texts`, não tem arquivo no repositório**
(nem no git, nem em stash/branch/worktree):

```
20261010004804  20261010005104  20261010005158  20261010005212  20261010005223
20261010005545  20261010010030  20261010020517  20261010110050  20261010163158
```

Todas de 2026-10-10 (00:48 → 16:31) — dez tentativas no mesmo dia, e o
`docs/correcoes.md:16` chama a que vingou de `010_storefront_texts`.

**O que essas migrations fizeram — verificado, e é pouco:**

| Objeto | Repo | Remoto | Veredito |
|---|---|---|---|
| `stores.marquee_text`, `stores.cover_url` | ausentes | presentes | **é todo o drift** |
| `create_order` | 21 exceções | as mesmas 21 | idêntico |
| `set_order_status` | 5 exceções | as mesmas 5 | idêntico |
| `fn_enforce_order_status_transition` | 4 exceções | as mesmas 4 | idêntico |
| assinaturas das 2 RPCs | — | idênticas ao repo | idênticas |
| tabelas (10), RLS, policies (15) | — | batem com `003` | idêntico |
| triggers | 7 | 7 | idêntico |
| índices | 14 | 14 + 16 de PK/unique | idêntico |

Ou seja: **`001`–`009` estão fielmente aplicadas**. O drift são as 2 colunas, mais
`ensure_rls`/`rls_auto_enable` (event trigger do próprio Supabase, não do projeto — não
tocar).

**O app não está quebrado** — as colunas existem no banco. O que está quebrado é o
repositório reproduzir o banco.

**Consequência bloqueante:** `npx supabase db push --dry-run` recusa com
`DbPushMissingLocalError: Remote migration versions not found in local migrations
directory`. **Toda** migration deste plano falha até a reconciliação. Ele recusa e não
aplica nada — não há risco de perda de dados no estado atual.

**Files:**
- Create: `supabase/migrations/010_storefront_texts.sql`

**Interfaces:**
- Consumes: tabela `stores`.
- Produces: histórico local == remoto, pré-requisito de `db push` para as Tarefas 1, 6 e 9.

- [ ] **Step 1: Recuperar o arquivo da migration perdida, verbatim**

O Supabase guardou o SQL de `010_storefront_texts` (versão `20261010163158`). Ele é
recuperável, não há nada a inventar. Criar `supabase/migrations/010_storefront_texts.sql`
com o conteúdo **exato** lido do remoto:

```sql
-- 010_storefront_texts — C-04 (texto do letreiro por loja) + C-07 (foto de capa).
-- Nulável: null/vazio = letreiro oculto na vitrine. Leitura anon já coberta
-- pela policy "anon_select" em stores (table-level); escrita via "lojista_all".
alter table stores add column if not exists marquee_text text;
alter table stores add column if not exists cover_url text;
```

**Não** reescrever, **não** renumerar, **não** criar uma migration nova para "consertar":
o arquivo é o original. Ler o corpo de novo direto da fonte antes de gravar:

```sql
select array_to_string(statements, E'\n') from supabase_migrations.schema_migrations
 where version = '20261010163158';
```

- [ ] **Step 2: Reparar o histórico (mexe no projeto de produção — confirmar antes)**

As 10 entradas do remoto são as suas `001`–`009` + a `010_storefront_texts`; só o
formato do `version` difere (timestamp no remoto, `NNN` no repo). O comando abaixo
remove as 10 e devolve cada uma com o número do repo, na ordem original:

```bash
npx supabase migration repair --status reverted 20261010004804 20261010005104 20261010005158 20261010005212 20261010005223 20261010005545 20261010010030 20261010020517 20261010110050 20261010163158
npx supabase migration repair --status applied 001 002 003 004 005 006 007 008 009 010
```

Expected: `npx supabase migration list --linked` mostra cada linha com local == remoto
(`001`↔`001` … `010`↔`010`), sem nenhuma linha só-remota ou só-local.

**Decisão do dono (2026-10-11):** formato **(A)**, números do repo, série sequencial.
Repair **autorizado**. Não perguntar de novo.

- [ ] **Step 3: Confirmar que `db push` voltou a funcionar**

Run: `npx supabase db push --linked --dry-run`
Expected: sem `DbPushMissingLocalError`. **Nada pendente** — local == remoto, porque a
`010_storefront_texts` já está aplicada no banco e acabou de ser marcada como tal.
(O `010` recém-criado é o arquivo **daquela** migration, não uma migration nova.)

- [ ] **Step 4: Verificar as colunas no remoto**

`db push` não tem o que aplicar (passo 3). A verificação é a leitura do estado real,
pelo conector Supabase (somente leitura):
```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'stores'
   and column_name in ('marquee_text','cover_url') order by 1;
```
Expected: duas linhas — `cover_url`, `marquee_text`.

- [ ] **Step 5: Verificar o caminho real do painel**

Run: `npm run dev`, abrir `http://localhost:3000/painel/configuracoes`, aba "Loja"
Expected: preencher "Texto do letreiro", salvar, recarregar — persiste, sem erro de
coluna inexistente no console.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/010_storefront_texts.sql
git commit -m "fix(db): versiona marquee_text e cover_url e reconcilia o historico de migrations"
```

---

### Task 1: Migration `011` — tabela `sales_goals` com RLS

**Files:**
- Create: `supabase/migrations/011_sales_goals.sql`

**Interfaces:**
- Consumes: `auth_store_id()` (`supabase/migrations/002_functions_triggers.sql:21`).
- Produces: tabela `sales_goals(store_id uuid, period text, target_cents integer)`, PK `(store_id, period)`. Nenhuma outra tarefa cria ou altera esta tabela.

- [ ] **Step 1: Escrever a migration**

Conteúdo completo de `supabase/migrations/011_sales_goals.sql`:

```sql
-- 011_sales_goals.sql — meta de faturamento por loja e período.
-- Só o ALVO é gravado; a janela (dia/semana/mês) é derivada na leitura
-- (design D2) — dataInicio/dataFim envelheciam no cardapio-digital.
create table if not exists sales_goals (
  store_id uuid not null references stores on delete cascade,
  period text not null check (period in ('daily','weekly','monthly')),
  target_cents integer not null check (target_cents > 0),
  primary key (store_id, period)
);

alter table sales_goals enable row level security;

drop policy if exists "lojista_all" on sales_goals;
create policy "lojista_all" on sales_goals
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());
```

- [ ] **Step 2: Aplicar a migration**

Run: `npx supabase db push` (ou `npx supabase migration up` no ambiente local)
Expected: `011_sales_goals.sql` aplicada sem erro.

- [ ] **Step 3: Verificar tabela, RLS e policy no remoto**

Ler o estado real pelo conector Supabase (somente leitura) — `db diff`/`db dump` exigem
Docker, que não existe nesta máquina:

```sql
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policies p
         where p.schemaname='public' and p.tablename=c.relname) as policies
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='sales_goals';
```
Expected: uma linha — `sales_goals`, `relrowsecurity = true`, `policies = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_sales_goals.sql
git commit -m "feat(db): sales_goals com RLS por loja"
```

---

### Task 2: Helper de período + filtro na tela Hoje

**Files:**
- Create: `lib/period.ts`
- Create: `lib/period.test.ts`
- Modify: `lib/painel.ts:15-38` (`getHoje`)
- Modify: `app/painel/page.tsx` (controles de período)

**Interfaces:**
- Consumes: `manausDayStartISO` (`lib/painel-utils.ts:17`), `requireStore()` (`lib/auth.ts`).
- Produces, para todas as tarefas seguintes:
  - `type PeriodKind = "today" | "7d" | "30d" | "90d" | "custom"`
  - `PERIOD_KINDS: readonly PeriodKind[]`
  - `PERIOD_LABEL: Record<PeriodKind, string>`
  - `parsePeriodKind(v: string | undefined | null): PeriodKind` — inválido → `"today"`
  - `resolvePeriod(kind: PeriodKind, opts?: { fromIso?: string; toIso?: string; now?: Date }): { from: string; to: string }` — ISO UTC; `to` é **exclusivo** (meia-noite seguinte em Manaus)
  - `getHoje(period?: string)` — assinatura nova, aceita o param cru da URL

- [ ] **Step 1: Escrever o teste que falha**

`lib/period.test.ts`:

```ts
import { test, expect } from "vitest";
import { parsePeriodKind, resolvePeriod } from "./period";

// 2026-10-11T14:30:00Z = 2026-10-11 10:30 em Manaus (UTC-4 fixo)
const NOW = new Date("2026-10-11T14:30:00Z");

test("parsePeriodKind aceita as chaves conhecidas e cai em today no lixo", () => {
  expect(parsePeriodKind("7d")).toBe("7d");
  expect(parsePeriodKind("90d")).toBe("90d");
  expect(parsePeriodKind(undefined)).toBe("today");
  expect(parsePeriodKind("")).toBe("today");
  expect(parsePeriodKind("30")).toBe("today");   // não é chave válida
  expect(parsePeriodKind("<script>")).toBe("today");
});

test("resolvePeriod('today') é a meia-noite de Manaus até a próxima (exclusivo)", () => {
  const p = resolvePeriod("today", { now: NOW });
  expect(p.from).toBe("2026-10-11T04:00:00.000Z");
  expect(p.to).toBe("2026-10-12T04:00:00.000Z");
});

test("resolvePeriod('7d') cobre 7 dias de calendário de Manaus, inclusive hoje", () => {
  const p = resolvePeriod("7d", { now: NOW });
  expect(p.from).toBe("2026-10-05T04:00:00.000Z"); // 11 - 6 dias
  expect(p.to).toBe("2026-10-12T04:00:00.000Z");
});

test("resolvePeriod custom usa as datas dadas, com to exclusivo", () => {
  const p = resolvePeriod("custom", { fromIso: "2026-10-01", toIso: "2026-10-03", now: NOW });
  expect(p.from).toBe("2026-10-01T04:00:00.000Z");
  expect(p.to).toBe("2026-10-04T04:00:00.000Z"); // dia seguinte ao toIso
});

test("resolvePeriod custom com data invertida ou lixo cai em 7d (nunca intervalo vazio)", () => {
  const invertida = resolvePeriod("custom", { fromIso: "2026-10-05", toIso: "2026-10-01", now: NOW });
  expect(invertida).toEqual(resolvePeriod("7d", { now: NOW }));
  const lixo = resolvePeriod("custom", { fromIso: "ontem", toIso: "2026-10-03", now: NOW });
  expect(lixo).toEqual(resolvePeriod("7d", { now: NOW }));
});

test("resolvePeriod sempre devolve from < to", () => {
  for (const kind of ["today", "7d", "30d", "90d"] as const) {
    const p = resolvePeriod(kind, { now: NOW });
    expect(new Date(p.from).getTime()).toBeLessThan(new Date(p.to).getTime());
  }
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/period.test.ts`
Expected: FAIL — `Failed to resolve import "./period"`.

- [ ] **Step 3: Implementar `lib/period.ts`**

```ts
// Janela de período do painel (design C7): UM helper para todas as telas.
// Fronteiras em America/Manaus; `to` é EXCLUSIVO (meia-noite seguinte).
import { manausDayStartISO } from "./painel-utils";

export type PeriodKind = "today" | "7d" | "30d" | "90d" | "custom";
export const PERIOD_KINDS: readonly PeriodKind[] = ["today", "7d", "30d", "90d", "custom"];
export const PERIOD_LABEL: Record<PeriodKind, string> = {
  today: "Hoje", "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", custom: "Personalizado",
};

export function parsePeriodKind(v: string | undefined | null): PeriodKind {
  return (PERIOD_KINDS as readonly string[]).includes(v ?? "") ? (v as PeriodKind) : "today";
}

const DAY_MS = 86_400_000;
// "2026-10-01" → meia-noite de Manaus daquele dia (ISO UTC).
// Meio-dia UTC garante que o instante cai no dia certo em Manaus (UTC-4).
const dayStart = (ymd: string): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? manausDayStartISO(new Date(`${ymd}T12:00:00Z`)) : null;

export function resolvePeriod(
  kind: PeriodKind,
  opts: { fromIso?: string; toIso?: string; now?: Date } = {}
): { from: string; to: string } {
  const now = opts.now ?? new Date();
  const hojeStart = new Date(manausDayStartISO(now));
  const toExclusivo = new Date(hojeStart.getTime() + DAY_MS).toISOString();
  const dias = { today: 1, "7d": 7, "30d": 30, "90d": 90 } as const;

  if (kind === "custom") {
    const from = opts.fromIso ? dayStart(opts.fromIso) : null;
    const to = opts.toIso ? dayStart(opts.toIso) : null;
    // invertido ou inválido → 7d (Review Focus #5); nunca intervalo vazio em silêncio
    if (from && to && new Date(from) < new Date(to)) {
      return { from, to: new Date(new Date(to).getTime() + DAY_MS).toISOString() };
    }
    return resolvePeriod("7d", { now });
  }

  const from = new Date(hojeStart.getTime() - (dias[kind] - 1) * DAY_MS).toISOString();
  return { from, to: toExclusivo };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/period.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Ligar o período em `getHoje`**

Em `lib/painel.ts`, trocar a assinatura e o filtro de `getHoje`:

```ts
export async function getHoje(period: string = "today") {
  const { supabase, storeId } = await requireStore();
  const now = Date.now();
  const { from, to } = resolvePeriod(parsePeriodKind(period));
  const [{ data: store }, { data: rows }] = await Promise.all([
    supabase.from("stores").select("name,force_closed,force_closed_at").eq("id", storeId).single(),
    supabase.from("orders").select(ORDER_COLS).eq("store_id", storeId)
      .gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false }),
  ]);
  // resto do corpo inalterado
```

Import no topo do arquivo: `import { parsePeriodKind, resolvePeriod } from "./period";`

Atenção: `getHoje` também alimenta o bloco "recentes" — ele passa a mostrar os recentes do período, o que é o comportamento desejado.

- [ ] **Step 6: Rodar a suíte inteira e o lint**

Run: `npm run test && npm run lint`
Expected: PASS. Nenhum teste existente quebra (`getHoje` ganhou default, então chamadas sem argumento seguem válidas).

- [ ] **Step 7: Adicionar os controles de período na tela Hoje**

Em `app/painel/page.tsx`, adicionar a linha de botões (mesmo padrão visual das abas de Configurações, `app/painel/configuracoes/page.tsx:191-195`), com `useState<PeriodKind>("today")` e recarregando `getHoje(period)` quando muda. `PERIOD_LABEL` fornece o texto — não escrever os rótulos à mão.

- [ ] **Step 8: Verificar no browser**

Run: `npm run dev` e abrir `http://localhost:3000/painel`
Expected: os 5 botões aparecem, "Hoje" ativo; clicar em "7 dias" muda os números do topo sem erro no console.

- [ ] **Step 9: Commit**

```bash
git add lib/period.ts lib/period.test.ts lib/painel.ts app/painel/page.tsx
git commit -m "feat(painel): filtro de periodo (hoje/7/30/90/custom) na tela Hoje"
```

---

### Task 3: Filtro de período e tipo no kanban + tempo no status atual

**Files:**
- Create: `lib/order-timing.ts`
- Create: `lib/order-timing.test.ts`
- Modify: `lib/painel.ts:198-208` (`getKanban`)
- Modify: `lib/painel-utils.ts` (campo novo em `PanelOrder`)
- Modify: `app/painel/pedidos/page.tsx:13-33` (filtros) e `:179-202` (exibição do tempo)

**Interfaces:**
- Consumes: `resolvePeriod`, `parsePeriodKind` (Tarefa 2); `order_events` (`supabase/migrations/001_schema.sql:134`); `toPanelOrder` (`lib/painel-utils.ts:34`).
- Produces:
  - `PanelOrder` ganha `statusMinutes: number` — minutos desde a última transição de status; se não houver evento, igual a `minutesAgo`.
  - `minutesInStatus(events: { to_status: string; created_at: string }[], currentStatus: string, createdAt: string, now?: number): number`
  - `getKanban(period?: string, type?: string)` — assinatura nova; devolve `{ orders, anteriores, cancelled }`, onde `anteriores` são os não finalizados criados antes do período (coluna "Anteriores", D7)

- [ ] **Step 1: Escrever o teste que falha**

`lib/order-timing.test.ts`:

```ts
import { test, expect } from "vitest";
import { minutesInStatus } from "./order-timing";

const NOW = new Date("2026-10-11T14:30:00Z").getTime();
const min = (n: number) => new Date(NOW - n * 60_000).toISOString();

test("usa o evento mais recente que levou ao status atual", () => {
  const events = [
    { to_status: "confirmed", created_at: min(30) },
    { to_status: "preparing", created_at: min(12) },
  ];
  expect(minutesInStatus(events, "preparing", min(30), NOW)).toBe(12);
});

test("sem evento, cai no tempo desde a criação", () => {
  expect(minutesInStatus([], "new", min(45), NOW)).toBe(45);
});

test("ignora eventos de outros status e pega o último do status atual", () => {
  const events = [
    { to_status: "confirmed", created_at: min(40) },
    { to_status: "preparing", created_at: min(20) },
    { to_status: "ready", created_at: min(5) },
  ];
  // status atual é preparing: o evento ready é mais novo mas não é o atual
  expect(minutesInStatus(events, "preparing", min(40), NOW)).toBe(20);
});

test("nunca devolve negativo (relógio do cliente adiantado)", () => {
  const events = [{ to_status: "preparing", created_at: min(-5) }];
  expect(minutesInStatus(events, "preparing", min(-5), NOW)).toBe(0);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/order-timing.test.ts`
Expected: FAIL — `Failed to resolve import "./order-timing"`.

- [ ] **Step 3: Implementar `lib/order-timing.ts`**

```ts
// Tempo no status ATUAL (design C1: derivado de order_events, nunca gravado).
// Sem evento (pedido ainda em 'new'), o tempo é desde a criação.
export function minutesInStatus(
  events: { to_status: string; created_at: string }[],
  currentStatus: string,
  createdAt: string,
  now: number = Date.now()
): number {
  let reference = createdAt;
  for (const e of events) {
    if (e.to_status === currentStatus && e.created_at > reference) reference = e.created_at;
  }
  return Math.max(0, Math.round((now - new Date(reference).getTime()) / 60_000));
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/order-timing.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Adicionar `statusMinutes` a `PanelOrder`**

Em `lib/painel-utils.ts`, adicionar `statusMinutes: number` ao tipo `PanelOrder` e ao retorno de `toPanelOrder`, com default igual a `minutesAgo`:

```ts
export const toPanelOrder = (o: PanelRow, now = Date.now(), statusMinutes?: number): PanelOrder => ({
  // ...campos existentes...
  statusMinutes: statusMinutes ?? Math.max(0, Math.round((now - new Date(o.created_at).getTime()) / 60000)),
});
```

Terceiro parâmetro com default mantém todos os chamadores atuais válidos.

- [ ] **Step 6: `getKanban` com período, tipo e eventos**

Em `lib/painel.ts`, `getKanban` passa a aceitar os filtros e buscar os eventos. A
consulta é em **duas partes**: (a) os pedidos criados no período escolhido; (b) os
**não finalizados criados antes do período** — a coluna "Anteriores" (design D7), que
garante que um pedido travado nunca desapareça da tela.

```ts
export async function getKanban(period: string = "today", type: string = "all") {
  const { supabase, storeId } = await requireStore();
  const now = Date.now();
  const { from, to } = resolvePeriod(parsePeriodKind(period));

  const cols = (q: ReturnType<typeof supabase.from>) => q.select(ORDER_COLS).eq("store_id", storeId);
  let periodo = cols(supabase.from("orders")).gte("created_at", from).lt("created_at", to);
  if (type === "delivery" || type === "pickup") periodo = periodo.eq("type", type);
  const { data: rows, error: e1 } = await periodo.order("created_at", { ascending: true });
  if (e1) throw new Error(e1.message); // design C5: nunca engolir

  // "Anteriores" (D7): não finalizados criados ANTES do início do período.
  const NAO_FINALIZADOS = "new,confirmed,preparing,ready,out";
  let antigosQ = cols(supabase.from("orders"))
    .lt("created_at", from).in("status", NAO_FINALIZADOS.split(","));
  if (type === "delivery" || type === "pickup") antigosQ = antigosQ.eq("type", type);
  const { data: antigos, error: e2 } = await antigosQ.order("created_at", { ascending: true });
  if (e2) throw new Error(e2.message);

  const orders = [...((rows ?? []) as PanelRow[])];
  const anteriores = ((antigos ?? []) as PanelRow[]);

  const ids = orders.filter((o) => !["new", "delivered", "cancelled"].includes(o.status)).map((o) => o.id);
  const { data: events, error: e3 } = ids.length
    ? await supabase.from("order_events").select("order_id,to_status,created_at").in("order_id", ids)
    : { data: [] as { order_id: string; to_status: string; created_at: string }[], error: null };
  if (e3) throw new Error(e3.message);
  const byOrder = new Map<string, { to_status: string; created_at: string }[]>();
  for (const e of events ?? []) byOrder.set(e.order_id, [...(byOrder.get(e.order_id) ?? []), e]);

  const mapped = orders.map((o) =>
    toPanelOrder(o, now, minutesInStatus(byOrder.get(o.id) ?? [], o.status, o.created_at, now))
  );
  return {
    orders: mapped,
    anteriores: anteriores.map((o) => toPanelOrder(o, now)),
    cancelled: mapped.filter((o) => o.status === "cancelled"),
  };
}
```

Import: `import { minutesInStatus } from "./order-timing";`

Nota: o kanban deixa de ter a janela "não finalizados + hoje" e passa a ter "criados no
período" **mais** a coluna "Anteriores" com os não finalizados fora da janela (D7).
Um pedido travado há dois dias continua visível em "Hoje", na coluna "Anteriores".

- [ ] **Step 7: Rodar a suíte e o lint**

Run: `npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 8: Filtros e exibição na página**

Em `app/painel/pedidos/page.tsx`: (a) linha de botões de período reusando `PERIOD_LABEL`, e botões de tipo "Todos / Entrega / Retirada"; (b) **uma coluna "Anteriores"** (design D7) ao lado das colunas de status, listando `anteriores` — não finalizados criados antes do período, com o mesmo card do kanban; a coluna só aparece quando `anteriores.length > 0`; (c) trocar a linha `:189` de `há {o.minutesAgo} min` para usar `o.statusMinutes`, e o destaque de atraso (`:180`) passa a ser `o.status === "new" ? o.statusMinutes > 10 : o.statusMinutes > 30`. O limiar de 10 min em `new` é regra existente e não muda.

- [ ] **Step 9: Verificar no browser**

Run: `npm run dev`, abrir `http://localhost:3000/painel/pedidos`
Expected: filtros mudam as colunas; um pedido avançado mostra "há N min" contando desde a transição, não desde a criação.

- [ ] **Step 10: Commit**

```bash
git add lib/order-timing.ts lib/order-timing.test.ts lib/painel.ts lib/painel-utils.ts app/painel/pedidos/page.tsx
git commit -m "feat(painel): filtros de periodo/tipo e tempo no status atual no kanban"
```

---

### Task 4: Clientes com perfil e histórico

**Files:**
- Create: `lib/customers.ts`
- Create: `lib/customers.test.ts`
- Create: `app/painel/clientes/page.tsx`
- Modify: `lib/painel.ts` (nova action de leitura `getClientes`)
- Modify: `app/painel/shell.tsx:14-26` (item de navegação)

**Interfaces:**
- Consumes: `requireStore()`; `orders` (`customer_name`, `customer_phone`, `total_cents`, `status`, `created_at`).
- Produces:
  - `type CustomerProfile = "vip" | "recorrente" | "novo"`
  - `LIMITE_VIP_PEDIDOS = 5`, `LIMITE_VIP_GASTO_CENTS = 50000`
  - `classifyCustomer(orders: number, spentCents: number): CustomerProfile`
  - `aggregateCustomers(rows: { customer_name: string; customer_phone: string; total_cents: number; status: string; created_at: string }[]): Customer[]`
  - `type Customer = { phone: string; name: string; orders: number; spentCents: number; lastOrderAt: string; profile: CustomerProfile }`
  - `getClientes(): Promise<{ customers: Customer[] }>`
  - `getPedidosDoCliente(phone: string): Promise<{ orders: PanelRow[] }>` — últimas 10 linhas daquele telefone

- [ ] **Step 1: Escrever o teste que falha**

`lib/customers.test.ts`:

```ts
import { test, expect } from "vitest";
import { aggregateCustomers, classifyCustomer } from "./customers";

test("classifyCustomer: VIP por frequencia OU por gasto", () => {
  expect(classifyCustomer(6, 0)).toBe("vip");           // 6 > 5
  expect(classifyCustomer(1, 50000)).toBe("vip");       // gasto >= R$ 500
  expect(classifyCustomer(5, 49999)).toBe("recorrente"); // nem um nem outro
  expect(classifyCustomer(2, 0)).toBe("recorrente");
  expect(classifyCustomer(1, 2590)).toBe("novo");
  expect(classifyCustomer(0, 0)).toBe("novo");          // só cancelados
});

const row = (phone: string, name: string, cents: number, status = "delivered", at = "2026-10-10T12:00:00Z") =>
  ({ customer_name: name, customer_phone: phone, total_cents: cents, status, created_at: at });

test("agrega por telefone e ignora cancelados no total", () => {
  const out = aggregateCustomers([
    row("55999999999", "Ana", 2590),
    row("55999999999", "Ana", 2590, "cancelled"),
    row("55999999999", "Ana", 3000),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ phone: "55999999999", name: "Ana", orders: 2, spentCents: 5590 });
});

test("cliente so de cancelados fica com 0 pedidos e nunca e VIP", () => {
  const out = aggregateCustomers([
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
  ]);
  expect(out[0]).toMatchObject({ orders: 0, spentCents: 0, profile: "novo" });
});

test("usa o nome do pedido mais recente e ordena por gasto desc", () => {
  const out = aggregateCustomers([
    row("55222222222", "Nome Antigo", 1000, "delivered", "2026-10-01T12:00:00Z"),
    row("55222222222", "Nome Novo", 1000, "delivered", "2026-10-09T12:00:00Z"),
    row("55333333333", "Rico", 90000, "delivered", "2026-10-02T12:00:00Z"),
  ]);
  expect(out[0].phone).toBe("55333333333");
  expect(out.find((c) => c.phone === "55222222222")?.name).toBe("Nome Novo");
});

test("lastOrderAt e a data do pedido mais recente, inclusive cancelado", () => {
  const out = aggregateCustomers([
    row("55444444444", "Dora", 1000, "delivered", "2026-10-01T12:00:00Z"),
    row("55444444444", "Dora", 1000, "cancelled", "2026-10-08T12:00:00Z"),
  ]);
  expect(out[0].lastOrderAt).toBe("2026-10-08T12:00:00Z");
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/customers.test.ts`
Expected: FAIL — `Failed to resolve import "./customers"`.

- [ ] **Step 3: Implementar `lib/customers.ts`**

```ts
// Clientes derivados de orders (design D3): sem tabela, sem sincronizacao.
// Mesmos limiares do cardapio-digital (customers.ts:7-16), em centavos.
export type CustomerProfile = "vip" | "recorrente" | "novo";
export const LIMITE_VIP_PEDIDOS = 5;
export const LIMITE_VIP_GASTO_CENTS = 50_000; // R$ 500,00

export function classifyCustomer(orders: number, spentCents: number): CustomerProfile {
  if (orders > LIMITE_VIP_PEDIDOS || spentCents >= LIMITE_VIP_GASTO_CENTS) return "vip";
  if (orders > 1) return "recorrente";
  return "novo";
}

export type Customer = {
  phone: string; name: string; orders: number;
  spentCents: number; lastOrderAt: string; profile: CustomerProfile;
};

export function aggregateCustomers(
  rows: { customer_name: string; customer_phone: string; total_cents: number; status: string; created_at: string }[]
): Customer[] {
  const byPhone = new Map<string, { name: string; lastAt: string; orders: number; spent: number }>();
  for (const r of rows) {
    const cur = byPhone.get(r.customer_phone) ?? { name: r.customer_name, lastAt: r.created_at, orders: 0, spent: 0 };
    if (r.created_at > cur.lastAt) { cur.lastAt = r.created_at; cur.name = r.customer_name; }
    if (r.status !== "cancelled") { cur.orders += 1; cur.spent += r.total_cents; }
    byPhone.set(r.customer_phone, cur);
  }
  return [...byPhone.entries()]
    .map(([phone, v]) => ({
      phone, name: v.name, orders: v.orders, spentCents: v.spent,
      lastOrderAt: v.lastAt, profile: classifyCustomer(v.orders, v.spent),
    }))
    .sort((a, b) => b.spentCents - a.spentCents);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/customers.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Action de leitura `getClientes` em `lib/painel.ts`**

```ts
// Clientes (design D3): agrega o histórico inteiro da loja. Teto de 1000 linhas
// mais recentes — acima disso a lista fica parcial.
// ponytail: agrega no servidor sobre 1000 pedidos; se a loja passar disso, trocar
// por uma view materializada.
export async function getClientes() {
  const { supabase, storeId } = await requireStore();
  const { data, error } = await supabase.from("orders")
    .select("customer_name,customer_phone,total_cents,status,created_at")
    .eq("store_id", storeId).order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message); // design C5: nunca engolir
  return { customers: aggregateCustomers(data ?? []) };
}
```

- [ ] **Step 6: Rodar a suíte e o lint**

Run: `npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 7: Página `app/painel/clientes/page.tsx`**

Server Component que chama `getClientes()` e renderiza: quatro cartões de contagem (Todos / VIP / Recorrentes / Novos) e a lista (nome, telefone, nº de pedidos, total gasto em `brl`, "último há N d", badge do perfil). Clique abre a lista de pedidos daquele telefone — um `Link` para `/painel/pedidos` com o telefone como filtro de busca não existe ainda, então o detalhe é um painel lateral com as últimas 10 linhas do histórico daquele cliente (segunda action `getPedidosDoCliente(phone)` na mesma tarefa, reusando `ORDER_COLS`).

- [ ] **Step 8: Item de navegação**

Em `app/painel/shell.tsx`, adicionar `{ href: "/painel/clientes", label: "Clientes", icon: "pedidos" }` ao grupo "Gestão" (`:21-25`).

- [ ] **Step 9: Verificar no browser**

Run: `npm run dev`, abrir `http://localhost:3000/painel/clientes`
Expected: contagens batem com os pedidos da loja; cancelados não inflam "total gasto".

- [ ] **Step 10: Commit**

```bash
git add lib/customers.ts lib/customers.test.ts lib/painel.ts app/painel/clientes/page.tsx app/painel/shell.tsx
git commit -m "feat(painel): pagina de clientes com perfil derivado dos pedidos"
```

---

### Task 5: Relatórios — meta de faturamento e mais vendidos

**Files:**
- Create: `lib/goals.ts`
- Create: `lib/goals.test.ts`
- Create: `app/painel/relatorios/page.tsx`
- Modify: `lib/painel.ts` (actions `getRelatorios`, `saveMeta`)
- Modify: `lib/painel-actions.ts` (mutação `saveMeta`)
- Modify: `app/painel/shell.tsx` (item de navegação)

**Interfaces:**
- Consumes: `resolvePeriod`, `parsePeriodKind` (Tarefa 2); tabela `sales_goals` (Tarefa 1); `mutate()` (`lib/painel-actions.ts:28`); `brl` (`app/[slug]/menu-data.ts`).
- Produces:
  - `type GoalPeriod = "daily" | "weekly" | "monthly"`
  - `GOAL_PERIODS: readonly GoalPeriod[]`, `GOAL_LABEL: Record<GoalPeriod, string>`
  - `windowFor(period: GoalPeriod, now?: Date): { from: string; to: string }`
  - `goalProgress(targetCents: number, revenueCents: number): { ratio: number; percent: number } | null` — `null` quando `targetCents <= 0`
  - `getRelatorios(period?: string)` — `{ from, to, revenueCents, ticketCents, count, topProducts, metas }`
  - `saveMeta(period: GoalPeriod, targetCents: number): Promise<R>`

- [ ] **Step 1: Escrever o teste que falha**

`lib/goals.test.ts`:

```ts
import { test, expect } from "vitest";
import { goalProgress, windowFor } from "./goals";

// 2026-10-11T14:30:00Z = sabado 2026-10-11 10:30 em Manaus
const NOW = new Date("2026-10-11T14:30:00Z");

test("windowFor daily e o dia de Manaus, to exclusivo", () => {
  expect(windowFor("daily", NOW)).toEqual({
    from: "2026-10-11T04:00:00.000Z", to: "2026-10-12T04:00:00.000Z",
  });
});

test("windowFor weekly comeca na segunda-feira de Manaus", () => {
  // 2026-10-11 e sabado; segunda da mesma semana e 2026-10-05
  const w = windowFor("weekly", NOW);
  expect(w.from).toBe("2026-10-05T04:00:00.000Z");
  expect(w.to).toBe("2026-10-12T04:00:00.000Z");
});

test("windowFor monthly cobre o mes corrente de Manaus", () => {
  const m = windowFor("monthly", NOW);
  expect(m.from).toBe("2026-10-01T04:00:00.000Z");
  expect(m.to).toBe("2026-11-01T04:00:00.000Z");
});

test("goalProgress nunca divide por zero nem passa de 100%", () => {
  expect(goalProgress(0, 10000)).toBeNull();
  expect(goalProgress(-1, 10000)).toBeNull();
  expect(goalProgress(10000, 0)).toEqual({ ratio: 0, percent: 0 });
  expect(goalProgress(10000, 5000)).toEqual({ ratio: 0.5, percent: 50 });
  expect(goalProgress(10000, 10000)).toEqual({ ratio: 1, percent: 100 });
  expect(goalProgress(10000, 25000)).toEqual({ ratio: 1, percent: 100 }); // clamp
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/goals.test.ts`
Expected: FAIL — `Failed to resolve import "./goals"`.

- [ ] **Step 3: Implementar `lib/goals.ts`**

```ts
// Meta de faturamento (design D2): so o ALVO e gravado; a janela e derivada aqui.
import { manausDayStartISO } from "./painel-utils";

export type GoalPeriod = "daily" | "weekly" | "monthly";
export const GOAL_PERIODS: readonly GoalPeriod[] = ["daily", "weekly", "monthly"];
export const GOAL_LABEL: Record<GoalPeriod, string> = {
  daily: "Meta do dia", weekly: "Meta da semana", monthly: "Meta do mês",
};

const DAY_MS = 86_400_000;

export function windowFor(period: GoalPeriod, now: Date = new Date()): { from: string; to: string } {
  const hoje = new Date(manausDayStartISO(now));
  if (period === "daily") {
    return { from: hoje.toISOString(), to: new Date(hoje.getTime() + DAY_MS).toISOString() };
  }
  if (period === "weekly") {
    // dia da semana em Manaus; getUTCDay de `hoje` (04:00Z) e o dia local correto
    const dow = hoje.getUTCDay();                 // 0=domingo
    const segunda = new Date(hoje.getTime() - ((dow + 6) % 7) * DAY_MS);
    return { from: segunda.toISOString(), to: new Date(segunda.getTime() + 7 * DAY_MS).toISOString() };
  }
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1, 4));
  const inicioMesSeguinte = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1, 4));
  return { from: inicioMes.toISOString(), to: inicioMesSeguinte.toISOString() };
}

export function goalProgress(
  targetCents: number, revenueCents: number
): { ratio: number; percent: number } | null {
  if (!(targetCents > 0)) return null; // Review Focus #2: sem meta, sem bloco
  const ratio = Math.min(Math.max(revenueCents / targetCents, 0), 1);
  return { ratio, percent: Math.round(ratio * 100) };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/goals.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Actions em `lib/painel.ts`**

```ts
// Relatorios (design C1): faturamento do periodo + mais vendidos + metas.
// Uma passada em orders + uma em order_items; sem tabela derivada.
export async function getRelatorios(period: string = "7d") {
  const { supabase, storeId } = await requireStore();
  const { from, to } = resolvePeriod(parsePeriodKind(period));

  const { data: orders, error: e1 } = await supabase.from("orders")
    .select("id,total_cents,status,created_at").eq("store_id", storeId)
    .gte("created_at", from).lt("created_at", to);
  if (e1) throw new Error(e1.message);

  const validos = (orders ?? []).filter((o) => o.status !== "cancelled");
  const revenueCents = validos.reduce((s, o) => s + o.total_cents, 0);
  const ticketCents = validos.length ? Math.round(revenueCents / validos.length) : 0;

  const ids = validos.map((o) => o.id);
  const { data: items, error: e2 } = ids.length
    ? await supabase.from("order_items").select("name_snapshot,qty,unit_price_cents").in("order_id", ids)
    : { data: [] as { name_snapshot: string; qty: number; unit_price_cents: number }[], error: null };
  if (e2) throw new Error(e2.message);

  const topMap = new Map<string, { qty: number; cents: number }>();
  for (const it of items ?? []) {
    const cur = topMap.get(it.name_snapshot) ?? { qty: 0, cents: 0 };
    cur.qty += it.qty; cur.cents += it.qty * it.unit_price_cents;
    topMap.set(it.name_snapshot, cur);
  }
  const topProducts = [...topMap.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, cents: v.cents }))
    .sort((a, b) => b.cents - a.cents).slice(0, 10);

  const { data: goals, error: e3 } = await supabase.from("sales_goals")
    .select("period,target_cents").eq("store_id", storeId);
  if (e3) throw new Error(e3.message);

  // faturamento de cada janela de meta, por periodo (1 query por janela distinta)
  const metas: { period: GoalPeriod; targetCents: number; revenueCents: number; percent: number }[] = [];
  for (const g of (goals ?? []) as { period: GoalPeriod; target_cents: number }[]) {
    const w = windowFor(g.period);
    const { data: janela, error: e4 } = await supabase.from("orders")
      .select("total_cents,status").eq("store_id", storeId)
      .gte("created_at", w.from).lt("created_at", w.to).neq("status", "cancelled");
    if (e4) throw new Error(e4.message);
    const revenue = (janela ?? []).reduce((s, o) => s + o.total_cents, 0);
    const p = goalProgress(g.target_cents, revenue);
    if (p) metas.push({ period: g.period, targetCents: g.target_cents, revenueCents: revenue, percent: p.percent });
  }

  return { from, to, revenueCents, ticketCents, count: validos.length, topProducts, metas };
}
```

Imports novos no topo de `lib/painel.ts`: `import { goalProgress, windowFor, type GoalPeriod } from "./goals";` e `import { aggregateCustomers } from "./customers";` (se ainda não estiver).

- [ ] **Step 6: Mutação `saveMeta` em `lib/painel-actions.ts`**

```ts
export async function saveMeta(period: GoalPeriod, targetCents: number): Promise<R> {
  const { supabase, storeId } = await requireStore();
  if (!(targetCents > 0)) return { ok: false, error: "A meta precisa ser maior que zero." };
  return mutate("/painel/relatorios", async () => {
    const { error } = await supabase.from("sales_goals")
      .upsert({ store_id: storeId, period, target_cents: targetCents }, { onConflict: "store_id,period" });
    return { error };
  });
}
```

Import: `import type { GoalPeriod } from "./goals";`

- [ ] **Step 7: Rodar a suíte e o lint**

Run: `npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 8: Página `app/painel/relatorios/page.tsx`**

Server Component com: filtro de período (`PERIOD_LABEL`), três cartões (Faturamento, Pedidos, Ticket médio), bloco de metas (uma linha por meta com barra de progresso e campo para definir/alterar o alvo, chamando `saveMeta`), e "Mais vendidos" (nome, quantidade, total). Sem meta cadastrada, o bloco de metas mostra o formulário vazio — nunca `0%`.

- [ ] **Step 9: Item de navegação**

Em `app/painel/shell.tsx`, adicionar `{ href: "/painel/relatorios", label: "Relatórios", icon: "hoje" }` ao grupo "Gestão".

- [ ] **Step 10: Verificar no browser**

Run: `npm run dev`, abrir `http://localhost:3000/painel/relatorios`
Expected: trocar período muda os cartões; definir meta de R$ 100 com R$ 50 vendidos mostra 50%.

- [ ] **Step 11: Commit**

```bash
git add lib/goals.ts lib/goals.test.ts lib/painel.ts lib/painel-actions.ts app/painel/relatorios/page.tsx app/painel/shell.tsx
git commit -m "feat(painel): relatorios com periodo, mais vendidos e metas"
```

---

### Task 6: Migration `012` — grupos de opção com RLS

**Files:**
- Create: `supabase/migrations/012_addon_groups.sql`

**Interfaces:**
- Consumes: `auth_store_id()`; tabela `product_addons` (`supabase/migrations/001_schema.sql:68`).
- Produces: tabela `product_addon_groups(id, store_id, name, required, max_choices, sort_order)` e coluna `product_addons.group_id uuid` nullable com FK composta `(group_id, store_id) → product_addon_groups(id, store_id) on delete cascade`.

- [ ] **Step 1: Escrever a migration**

```sql
-- 012_addon_groups.sql — grupos de opcao (design D4).
-- Grupo e o unico conceito; as OPCOES sao as linhas de product_addons com
-- group_id preenchido. group_id null = grupo "Adicionais" implicito, derivado
-- na leitura — nao ha backfill nem segunda forma de armazenar.
create table if not exists product_addon_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  required boolean not null default false,
  max_choices integer check (max_choices is null or max_choices >= 1),
  sort_order integer not null default 0,
  unique (id, store_id)
);

alter table product_addon_groups enable row level security;

drop policy if exists "lojista_all" on product_addon_groups;
create policy "lojista_all" on product_addon_groups
  for all to authenticated
  using (store_id = auth_store_id()) with check (store_id = auth_store_id());

alter table product_addons add column if not exists group_id uuid;

alter table product_addons drop constraint if exists product_addons_group_fk;
alter table product_addons
  add constraint product_addons_group_fk
  foreign key (group_id, store_id) references product_addon_groups (id, store_id)
  on delete cascade;

create index if not exists idx_addon_groups_store on product_addon_groups(store_id);
create index if not exists idx_addons_group        on product_addons(group_id);
```

- [ ] **Step 2: Aplicar a migration**

Run: `npx supabase db push` (ou `npx supabase migration up` no local)
Expected: `012_addon_groups.sql` aplicada sem erro.

- [ ] **Step 3: Verificar tabela, coluna, FK, RLS e policy no remoto**

Ler o estado real pelo conector Supabase (somente leitura) — `db diff`/`db dump` exigem
Docker, que não existe nesta máquina:

```sql
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policies p
         where p.schemaname='public' and p.tablename=c.relname) as policies
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='product_addon_groups';
```
Expected: uma linha — `product_addon_groups`, `relrowsecurity = true`, `policies = 1`.

```sql
select column_name, is_nullable from information_schema.columns
 where table_schema='public' and table_name='product_addons' and column_name='group_id';
select conname from pg_constraint where conname='product_addons_group_fk';
```
Expected: `group_id | YES` e uma linha `product_addons_group_fk`.

- [ ] **Step 4: Confirmar que a FK composta rejeita grupo de outra loja**

```sql
-- deve falhar com violacao de FK (grupo de outra loja)
insert into product_addons (store_id, name, price_cents, group_id)
values ('<store_A>', 'X', 100, '<group_of_store_B>');
```
Expected: `ERROR: insert or update on table "product_addons" violates foreign key constraint "product_addons_group_fk"`. Se passar, a FK está errada — parar e corrigir antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/012_addon_groups.sql
git commit -m "feat(db): grupos de opcao para adicionais, com RLS por loja"
```

---

### Task 7: `lib/addon-groups.ts` — agrupar e validar escolhas

**Files:**
- Create: `lib/addon-groups.ts`
- Create: `lib/addon-groups.test.ts`

**Interfaces:**
- Consumes: nada (puro).
- Produces:
  - `type AddonRow = { id: string; name: string; price_cents: number; group_id: string | null; active: boolean }`
  - `type AddonGroupRow = { id: string; name: string; required: boolean; max_choices: number | null; sort_order: number }`
  - `type AddonGroup = { id: string | null; name: string; required: boolean; maxChoices: number | null; addons: AddonRow[] }`
  - `IMPLICIT_GROUP_NAME = "Adicionais"`
  - `groupAddons(addons: AddonRow[], groups: AddonGroupRow[]): AddonGroup[]`
  - `validateChoice(groups: AddonGroup[], chosenIds: string[]): { ok: true } | { ok: false; error: string }`
  - `priceOf(addons: AddonRow[], chosenIds: string[]): number`

- [ ] **Step 1: Escrever o teste que falha**

`lib/addon-groups.test.ts`:

```ts
import { test, expect } from "vitest";
import { groupAddons, priceOf, validateChoice, type AddonGroupRow, type AddonRow } from "./addon-groups";

const a = (id: string, group_id: string | null, cents = 100): AddonRow =>
  ({ id, name: id, price_cents: cents, group_id, active: true });
const g = (id: string, required = false, max: number | null = null): AddonGroupRow =>
  ({ id, name: id, required, max_choices: max, sort_order: 0 });

test("adicionais sem group_id viram o grupo implicito 'Adicionais'", () => {
  const out = groupAddons([a("bacon", null), a("cheddar", null)], []);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ id: null, name: "Adicionais", required: false, maxChoices: null });
  expect(out[0].addons.map((x) => x.id)).toEqual(["bacon", "cheddar"]);
});

test("grupos explicitos vem ordenados e com seus adicionais", () => {
  const out = groupAddons(
    [a("catupiry", "borda"), a("cheddar", "borda"), a("bacon", "extras")],
    [{ id: "borda", name: "Borda", required: true, max_choices: 1, sort_order: 0 },
     { id: "extras", name: "Extras", required: false, max_choices: null, sort_order: 1 }]
  );
  expect(out.map((x) => x.name)).toEqual(["Borda", "Extras"]);
  expect(out[0]).toMatchObject({ required: true, maxChoices: 1 });
});

test("grupo explicito sem adicional ativo nao aparece", () => {
  const out = groupAddons([a("bacon", null)], [g("borda", true, 1)]);
  expect(out.map((x) => x.name)).toEqual(["Adicionais"]);
});

test("validateChoice: grupo obrigatorio exige ao menos uma escolha", () => {
  const groups = groupAddons([a("catupiry", "borda")], [g("borda", true, 1)]);
  expect(validateChoice(groups, []).ok).toBe(false);
  expect(validateChoice(groups, ["catupiry"]).ok).toBe(true);
});

test("validateChoice: respeita o maximo de escolhas", () => {
  const groups = groupAddons([a("c1", "extras"), a("c2", "extras")], [g("extras", false, 1)]);
  const bad = validateChoice(groups, ["c1", "c2"]);
  expect(bad.ok).toBe(false);
  expect(bad.ok === false && bad.error).toContain("1");
  expect(validateChoice(groups, ["c1"]).ok).toBe(true);
});

test("validateChoice: grupo obrigatorio sem opcao aplicavel NAO trava a venda", () => {
  // grupo obrigatorio, mas nenhum adicional ativo dele chega a este produto
  const groups = groupAddons([a("bacon", null)], [g("borda", true, 1)]);
  expect(validateChoice(groups, []).ok).toBe(true);   // Review Focus #3
  expect(validateChoice(groups, ["bacon"]).ok).toBe(true);
});

test("priceOf soma so os escolhidos", () => {
  expect(priceOf([a("bacon", null, 600), a("cheddar", null, 450)], ["bacon"])).toBe(600);
  expect(priceOf([a("bacon", null, 600)], [])).toBe(0);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/addon-groups.test.ts`
Expected: FAIL — `Failed to resolve import "./addon-groups"`.

- [ ] **Step 3: Implementar `lib/addon-groups.ts`**

```ts
// Grupos de adicional (design D4) — puro, sem banco.
// Regra de aplicabilidade: um grupo so incide sobre o produto se tem ao menos
// um adicional ativo; quem chama passa apenas os adicionais daquele produto.
// Sem essa regra, um grupo obrigatorio cujo unico adicional foi desativado
// travaria a venda (Review Focus #3).
export const IMPLICIT_GROUP_NAME = "Adicionais";

export type AddonRow = { id: string; name: string; price_cents: number; group_id: string | null; active: boolean };
export type AddonGroupRow = { id: string; name: string; required: boolean; max_choices: number | null; sort_order: number };
export type AddonGroup = { id: string | null; name: string; required: boolean; maxChoices: number | null; addons: AddonRow[] };

export function groupAddons(addons: AddonRow[], groups: AddonGroupRow[]): AddonGroup[] {
  const ativos = addons.filter((x) => x.active);
  const out: AddonGroup[] = [];
  for (const g of [...groups].sort((x, y) => x.sort_order - y.sort_order)) {
    const membros = ativos.filter((x) => x.group_id === g.id);
    if (membros.length > 0) {
      out.push({ id: g.id, name: g.name, required: g.required, maxChoices: g.max_choices, addons: membros });
    }
  }
  const soltos = ativos.filter((x) => x.group_id === null);
  if (soltos.length > 0) {
    out.push({ id: null, name: IMPLICIT_GROUP_NAME, required: false, maxChoices: null, addons: soltos });
  }
  return out;
}

export function validateChoice(
  groups: AddonGroup[], chosenIds: string[]
): { ok: true } | { ok: false; error: string } {
  for (const g of groups) {
    const escolhidos = g.addons.filter((x) => chosenIds.includes(x.id)).length;
    if (g.required && escolhidos === 0) {
      return { ok: false, error: `Escolha uma opção em "${g.name}".` };
    }
    if (g.maxChoices !== null && escolhidos > g.maxChoices) {
      return { ok: false, error: `"${g.name}" aceita no máximo ${g.maxChoices} escolha(s).` };
    }
  }
  return { ok: true };
}

export function priceOf(addons: AddonRow[], chosenIds: string[]): number {
  return addons.filter((x) => chosenIds.includes(x.id)).reduce((s, x) => s + x.price_cents, 0);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/addon-groups.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/addon-groups.ts lib/addon-groups.test.ts
git commit -m "feat(cardapio): logica pura de grupos de adicional"
```

---

### Task 8: Editor de grupos no painel do cardápio

**Files:**
- Create: `app/painel/cardapio/grupos.tsx` (editor de grupos e opções)
- Modify: `app/painel/cardapio/page.tsx` (aba/seção de grupos)
- Modify: `lib/painel.ts` (`getCardapio` passa a trazer grupos)
- Modify: `lib/painel-actions.ts` (mutação de grupos e de vínculo do adicional)

**Interfaces:**
- Consumes: `groupAddons`, `AddonGroupRow`, `AddonRow`, `IMPLICIT_GROUP_NAME` (Tarefa 7); `getCardapio` (`lib/painel.ts:105`); `mutate()`.
- Produces:
  - `CardapioData` ganha `groups: AddonGroupRow[]` e `addons: (PanelAddon & { group_id: string | null })[]`
  - `saveAddonGroup(input: { id?: string; name: string; required: boolean; maxChoices: number | null; sortOrder: number }): Promise<R & { id?: string }>`
  - `deleteAddonGroup(id: string): Promise<R>`
  - `setAddonGroup(addonId: string, groupId: string | null): Promise<R>`

- [ ] **Step 1: `getCardapio` traz os grupos**

Em `lib/painel.ts`, adicionar `product_addon_groups` ao `Promise.all` e incluir `group_id` no select de `product_addons`:

```ts
const [{ data: cats }, { data: prods }, { data: addons }, { data: prodAddons }, { data: groups }] = await Promise.all([
  // ...quatro selects existentes...
  supabase.from("product_addon_groups").select("id,name,required,max_choices,sort_order")
    .eq("store_id", storeId).order("sort_order"),
]);
```

Trocar o select de `product_addons` para `"id,name,price_cents,active,group_id"` e devolver `groups: groups ?? []` no retorno.

- [ ] **Step 2: Mutações de grupo**

Em `lib/painel-actions.ts`, no padrão de `addAddon`/`updateAddon`/`deleteAddon` (`:99-127`):

```ts
export async function saveAddonGroup(input: {
  id?: string; name: string; required: boolean; maxChoices: number | null; sortOrder: number;
}): Promise<R & { id?: string }> {
  const { supabase, storeId } = await requireStore();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 40) return { ok: false, error: "Nome do grupo: 1 a 40 letras." };
  if (input.maxChoices !== null && input.maxChoices < 1) {
    return { ok: false, error: "Máximo de escolhas precisa ser 1 ou mais (ou vazio)." };
  }
  const row = { store_id: storeId, name, required: input.required, max_choices: input.maxChoices, sort_order: input.sortOrder };
  const r = await mutate("/painel/cardapio", async () => {
    const q = input.id
      ? supabase.from("product_addon_groups").update(row).eq("id", input.id).eq("store_id", storeId).select("id").single()
      : supabase.from("product_addon_groups").insert(row).select("id").single();
    const { data, error } = await q;
    return { error, id: data?.id as string | undefined };
  });
  return r as R & { id?: string };
}

export async function deleteAddonGroup(id: string): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    // cascade na FK apaga as opcoes do grupo — avisar na UI antes de chamar
    const { error } = await supabase.from("product_addon_groups").delete().eq("id", id).eq("store_id", storeId);
    return { error };
  });
}

export async function setAddonGroup(addonId: string, groupId: string | null): Promise<R> {
  const { supabase, storeId } = await requireStore();
  return mutate("/painel/cardapio", async () => {
    const { error } = await supabase.from("product_addons").update({ group_id: groupId })
      .eq("id", addonId).eq("store_id", storeId);
    return { error };
  });
}
```

Nota: `mutate()` hoje só devolve `{ ok, error }`; para `saveAddonGroup` devolver o `id`, `mutate` precisa repassar o valor do callback. Ajustar a assinatura de `mutate` para `fn: () => Promise<{ error: unknown; id?: string }>` e devolver `{ ok: true, id }` — os chamadores atuais ignoram o campo extra, então nada quebra.

- [ ] **Step 3: Rodar a suíte e o lint**

Run: `npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 4: Editor de grupos**

`app/painel/cardapio/grupos.tsx`: lista de grupos (nome, badge "obrigatório", "máx N"), criar/editar/excluir grupo, e dentro de cada grupo as opções — as opções são os adicionais existentes; atribuir um adicional a um grupo usa `setAddonGroup`. Exibir o grupo implícito "Adicionais" (`group_id === null`) como leitura, sem nome editável, deixando claro que são os adicionais sem grupo. Antes de `deleteAddonGroup`, confirmar com o texto exato: `Isso apaga as N opções deste grupo. Continuar?`.

- [ ] **Step 5: Verificar no browser**

Run: `npm run dev`, abrir `http://localhost:3000/painel/cardapio`
Expected: criar grupo "Borda" obrigatório com máx 1; mover dois adicionais para ele; recarregar a página e o grupo persistir; excluir o grupo e os dois adicionais sumirem do cardápio.

- [ ] **Step 6: Commit**

```bash
git add app/painel/cardapio/grupos.tsx app/painel/cardapio/page.tsx lib/painel.ts lib/painel-actions.ts
git commit -m "feat(painel): editor de grupos de opcao no cardapio"
```

---

### Task 9: Grupos na vitrine e trava no servidor

**Files:**
- Modify: `lib/queries.ts` (`getAddons` → `getAddonGroups`)
- Modify: `app/[slug]/produto/[id]/page.tsx` e `produto-client.tsx` (render por grupo)
- Modify: `supabase/migrations/013_addon_group_enforcement.sql` (validação no RPC)
- Modify: `lib/api-errors.ts` (copy das duas exceções novas)

**Interfaces:**
- Consumes: `groupAddons`, `validateChoice`, `priceOf` (Tarefa 7); `create_order` (`supabase/migrations/002_functions_triggers.sql:309`); `mapOrderError` (`lib/api-errors.ts:43`).
- Produces: exceções `GROUP_REQUIRED` e `GROUP_MAX_CHOICES` no RPC, mapeadas para HTTP 422 em PT-BR.

- [ ] **Step 1: Leitura pública dos grupos**

Em `lib/queries.ts`, substituir `getAddons` por:

```ts
export async function getAddonGroups(store_id: string) {
  const supabase = await createClient();
  const [{ data: addons }, { data: groups }] = await Promise.all([
    supabase.from("product_addons").select("id,product_id,name,price_cents,active,group_id")
      .eq("store_id", store_id).eq("active", true),
    supabase.from("product_addon_groups").select("id,name,required,max_choices,sort_order")
      .eq("store_id", store_id).order("sort_order"),
  ]);
  return { addons: addons ?? [], groups: groups ?? [] };
}
```

`getAddons` fica órfã — **remover** (é o único chamador: `app/[slug]/produto/[id]/page.tsx:36`).

- [ ] **Step 2: Rodar a suíte e o lint**

Run: `npm run test && npm run lint`
Expected: PASS após ajustar o chamador.

- [ ] **Step 3: Render por grupo na página do produto**

Em `app/[slug]/produto/[id]/page.tsx`, trocar o filtro de adicionais por: pegar `{ addons, groups }`, filtrar os adicionais aplicáveis ao produto (`product_id === null || product_id === id`) e passar `groupAddons(adicionaisAplicaveis, groups)` para o client.

Em `produto-client.tsx`, renderizar um bloco por grupo (nome, "obrigatório", "máx N"), e antes de `addLine` chamar `validateChoice(groups, checked)`; se falhar, mostrar o `error` e não adicionar. O total usa `priceOf(adicionaisAplicaveis, checked)` no lugar de `addonsTotal` (`:21-25`).

- [ ] **Step 4: Migration `013` — trava no servidor**

`supabase/migrations/013_addon_group_enforcement.sql`: recriar `create_order` com o bloco de validação de grupo dentro do laço de itens, logo após o laço de adicionais de cada item. Declarar `v_grp product_addon_groups%rowtype;` e `v_chosen int;` no `declare`. Bloco exato:

```sql
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
          raise exception 'GROUP_MAX_CHOICES: % (máx %)', v_grp.name, v_grp.max_choices;
        end if;
      end loop;
    end if;
```

O resto do corpo de `create_order` fica **idêntico** ao da migration `002` — copiar integralmente e inserir só este bloco. `grant execute ... to service_role` continua valendo (a função foi recriada com `create or replace`, o grant persiste).

- [ ] **Step 5: Copy de erro em `lib/api-errors.ts`**

Em `mapOrderError`, antes do `TABLE[key]` final, adicionar o ramo que interpola o nome do grupo:

```ts
  if (key === "GROUP_REQUIRED")
    return { status: 422, code: key, message: `Escolha uma opção em "${arg}".` };
  if (key === "GROUP_MAX_CHOICES")
    return { status: 422, code: key, message: `"${arg}"` };
```

(`GROUP_MAX_CHOICES` já chega com o texto `Nome (máx N)` como argumento.)

- [ ] **Step 6: Aplicar a migration e verificar a trava**

Run: `npx supabase db push`
Expected: `013_addon_group_enforcement.sql` aplicada.

Verificar pelo RPC, com um grupo obrigatório e sem escolher nada:
```sql
select create_order('<store>', 'pickup', 'cash', null, null, null,
  '[{"id":"<produto>","qty":1,"addons":[]}]'::jsonb, null, null, 'Teste', '55999999999');
```
Expected: `ERROR: GROUP_REQUIRED: Borda`. Se criar o pedido, a trava não entrou — parar e corrigir.

- [ ] **Step 7: Verificar o caminho completo no browser**

Run: `npm run dev`, abrir a loja pública, entrar num produto com grupo obrigatório
Expected: o bloco do grupo aparece marcado "obrigatório"; tentar adicionar sem escolher mostra "Escolha uma opção em "Borda"." e não adiciona; escolhendo, adiciona com o preço certo.

- [ ] **Step 8: Rodar a suíte, o lint e o build**

Run: `npm run test && npm run lint && npm run build`
Expected: PASS nos três. O build é obrigatório aqui porque `getAddons` foi removida e qualquer chamador esquecido quebra o type-check.

- [ ] **Step 9: Commit**

```bash
git add lib/queries.ts app/[slug]/produto lib/api-errors.ts supabase/migrations/013_addon_group_enforcement.sql
git commit -m "feat(cardapio): grupos de opcao na vitrine e trava de grupo no create_order"
```

---

## Self-Review

**1. Cobertura da spec.** Os 6 itens aprovados: filtro de período (T2, T3, T5), tempo no status (T3), filtros do kanban (T3), clientes com perfil (T4), meta (T5), complementos com grupos (T6–T9). Os 10 critérios de implementação: C1 em T3/T4/T5, C2 e C3 em T1/T6, C4 em todas (helpers citados), C5 em T4/T5 (`throw new Error(error.message)`), C6 em T2/T5, C7 em T2, C8 em T1/T6/T9, C9 na ordem das tarefas, C10 em T2/T3/T4/T5/T7. A Tarefa 0 não vem da spec — é reparo de defeito pré-existente encontrado durante o recon (coluna usada pelo código, sem migration no repo). Sem lacuna.

**2. Escaneamento dos passos.** Nenhum passo carrega decisão de duas tarefas. Os corpos de código aparecem só onde a assinatura e o teste não determinam o corpo: o bloco SQL de grupo (algoritmo), o `resolvePeriod` e o `windowFor` (aritmética de fuso), e o bloco de validação do RPC. `saveAddonGroup` traz o corpo porque a assinatura de `mutate` muda junto.

**3. Consistência de tipos.** `PeriodKind`/`parsePeriodKind`/`resolvePeriod` definidos em T2 e usados em T3/T5 com a mesma forma. `AddonRow`/`AddonGroupRow`/`groupAddons`/`validateChoice` definidos em T7 e usados em T8/T9. `GoalPeriod`/`windowFor`/`goalProgress` definidos em T5. `PanelOrder.statusMinutes` definido em T3 e consumido só em T3.

**4. Review Focus.** Cada uma das 5 linhas tem teste na tarefa dona: #1 → T2 (`resolvePeriod today`, virada de dia), #2 → T5 (`goalProgress(0, …) === null`), #3 → T7 (grupo obrigatório sem opção aplicável) e T9 (bloco SQL com o `exists`), #4 → T4 (só cancelados → novo), #5 → T2 (custom invertido e lixo → 7d).

**5. Proporção.** 9 tarefas para 6 features; a maior parte do texto são asserções de teste e as três peças de aritmética/SQL que a assinatura não determina. Nenhum corpo de função de UI foi escrito — só a responsabilidade de cada tela.

---

## Decisão de formato do histórico (bloqueia a Tarefa 0)

O banco tem as suas `001`–`009` registradas com **versão em timestamp** (`20261010004804`)
e nome descritivo (`001_schema`), porque foram aplicadas com `db push` a partir de
arquivos sem prefixo de timestamp. O repositório usa `NNN_nome.sql`. Os dois formatos
não casam, e é isso que faz o CLI recusar.

Duas saídas, e a escolha é do dono — ela define como toda revisão humana vai ler o
histórico daqui pra frente:

**A. Histórico com número do repo (`001`, `002`, …, `010`, `011`, …)** — recomendada.
O `supabase migration list` mostra `001`↔`001`, e o número na tela é o mesmo do nome
do arquivo. É o formato que torna a revisão humana imediata: você olha a lista e vê a
série, sem traduzir timestamp para número. Custo: o `migration repair` da Tarefa 0
reescreve as 10 versões do remoto de timestamp para `001`–`010` (mesmo SQL, mesmos
nomes, só a coluna `version`).

**B. Histórico com timestamp** — o padrão do Supabase. Cada arquivo local ganha um
timestamp no nome (`20261011000000_011_sales_goals.sql`) e o `migration repair`
reescreve as 9 locais (`001`→timestamp, mantendo o SQL). Custo: renomear toda a série
existente e perder a leitura direta do número; em troca, fica no default da ferramenta.

Em ambas, a migration `010_storefront_texts` é o arquivo original recuperado do banco
— não uma migration de correção.

**A Tarefa 0 não roda sem esta decisão.**