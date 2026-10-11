# Paridade com o admin do cardapio-digital — design (v1)

Data: 2026-10-11 · Status: aprovado em escopo, aguardando revisão do design

## Intenção

O kero é funcional e tem uma stake simples de propósito: Next.js 15 + Supabase
direto, sem API intermediária. O cardapio-digital acumulou features mas perdeu
manutenibilidade (2 bancos, Prisma, Express, `businessId` repetido em toda query).
Esta v1 traz o que o mercado pede **dentro da stake do kero** — cada regra em um
lugar só, nada duplicado.

## Objetivo

Seis capacidades aprovadas, todas reaproveitando o que já existe:

1. Filtro de período (hoje / 7 / 30 / 90 / custom)
2. Tempo no status atual (não só desde a criação)
3. Kanban: filtro de período + filtro por tipo
4. Clientes com perfil (VIP / Recorrente / Novo) e histórico
5. Meta de faturamento com progresso
6. Complementos com grupos (obrigatório, máximo de escolhas)

## Não-objetivos

Drag&drop, mapa/geocoding, PDV/mesas, entregas/motoboy, caixa e contas a pagar,
impressora térmica, gestão de equipe, Pixel/GA4.

## Anti-objetivos

- Uma segunda forma de armazenar o que já existe (duplicata de dado).
- Tabela nova sem RLS na mesma migration (órfã).
- `catch` que devolve vazio e esconde falha (erro silencioso).
- Segunda tabela de mapeamento de erro, segundo helper de período, segundo
  caminho de renderização de adicional.

## Decisões tomadas (são minhas, não suas)

**D1 — "Financeiro" era erro meu.** O kero não tem essa página. O filtro de período
vai em Hoje e Pedidos, e a visão de faturamento por período + mais vendidos vira
`/painel/relatorios`. Mesmos 6 itens do escopo. Relatórios mostra: três cartões
(faturamento do período, nº de pedidos, ticket médio), o bloco de metas (uma linha
por meta, com campo para definir/alterar o alvo) e "Mais vendidos" — top 10 por
faturamento no período, com nome, quantidade e total.

**D2 — Meta guarda só o alvo, não a janela.** O cardapio grava `dataInicio`/`dataFim`
por meta, que envelhecem e viram dado morto. Aqui: `sales_goals(store_id, period,
target_cents)`, uma linha por período, PK `(store_id, period)`. `period` ∈
`('daily','weekly','monthly')` — uma só família de string (o cardapio tinha duas,
com e sem acento). A janela é **derivada** na leitura, sempre em America/Manaus:
`daily` = o dia corrente; `weekly` = a segunda-feira da semana corrente, +7 dias;
`monthly` = dia 1 do mês corrente ao dia 1 do seguinte.

**D3 — Cliente não ganha tabela.** Perfil e histórico são agregação sobre `orders`,
agrupada por `customer_phone`. Sem tabela, sem sincronização, sem órfão. Limiares,
os mesmos do cardapio-digital: **VIP** se `pedidos > 5` **ou** `gasto >= R$ 500`;
**Recorrente** se `pedidos > 1`; senão **Novo**. Pedidos cancelados não contam nem
em pedidos nem em gasto — um cliente só de cancelados é "novo" com 0 pedidos.

**D4 — Grupo de opção é o único conceito; o adicional legado é um grupo implícito.**
Tabela nova `product_addon_groups(id, store_id, name, required, max_choices,
sort_order)` — é onde moram "obrigatório" e "máximo de escolhas". As **opções** de um
grupo são as linhas de `product_addons` com `group_id` preenchido. `group_id is null`
= grupo "Adicionais" implícito, derivado na leitura — **não** é uma segunda forma de
armazenar. Sem backfill, sem migração de dados. A vitrine passa a ler os grupos
(`lib/queries.ts`), e o RPC `create_order` valida obrigatório e máximo no servidor —
a UI valida antes, o banco não confia nela.
`ponytail: grupo implícito evita backfill; quando todo lojista tiver migrado para grupos explícitos, tornar group_id not null.`

**D5 — Drag&drop recusado.** O avanço por botão é ação nomeada; no cardapio o card
errava a coluna.

**D6 — Tempo no status é campo ADICIONAL, não substituto.** `PanelOrder` ganha
`statusMinutes` e mantém `minutesAgo`. O kanban exibe o tempo no status atual; o
destaque vermelho de `new` continua pela criação — que, em `new`, é o mesmo instante,
então não há conflito. Nenhum chamador de `toPanelOrder` quebra (terceiro parâmetro
com default).

**D7 — O kanban passa a ter janela por período, MAIS uma coluna sempre visível.**
A coluna "Entregues" vira "entregues no período" em vez de "hoje". E, para que um
pedido não finalizado fora da janela não desapareça, o kanban ganha uma **coluna
"Anteriores" sempre visível**, com os não finalizados criados antes do início do
período (decisão do dono, 2026-10-11). Sem ela, um pedido travado há dois dias só
apareceria escolhendo "7 dias".

**D8 — Clientes vive em página nova.** `/painel/clientes`, item no grupo "Gestão" da
sidebar. O detalhe do cliente é um painel lateral com os últimos 10 pedidos daquele
telefone — sem rota nova por cliente.

## Critérios de implementação (as regras que evitam os três defeitos)

**C1 · Uma fonte de verdade por dado.** Nada derivado é gravado. Tempo no status vem
de `order_events`; perfil de cliente, de `orders`; progresso de meta, de
`orders` + `sales_goals`.

**C2 · Tabela nova nasce completa.** Na mesma migration: `create table`,
`alter table ... enable row level security`, policy do lojista por `store_id`,
e `grant` se necessário. Tabela sem policy é órfã — o lojista recebe 500 silencioso.

**C3 · Toda tabela nova tem `store_id` com `on delete cascade`.** Sem exceção.

**C4 · Reuso antes de criação.** Mutação passa por `mutate()` (`lib/painel-actions.ts:28`);
leitura do painel por `requireStore()`; copy de erro por `mapOrderError`/`mapStatusError`
(`lib/api-errors.ts`); forma do pedido por `toPanelOrder` (`lib/painel-utils.ts`);
fronteira de dia por `manausDayStartISO` (`lib/painel-utils.ts:17`).

**C5 · Erro nunca engolido no painel.** Action de leitura devolve dado ou lança com a
mensagem do Postgres. `catch` que devolve `[]`/`null` sem registrar é proibido no
painel (a vitrine pública em `lib/queries.ts` mantém os fallbacks dela — é decisão
deliberada de 404, não descuido).

**C6 · Fuso resolvido no servidor, sempre America/Manaus.** Nenhuma fronteira de dia
calculada no browser.

**C7 · Um helper de período para todas as telas.** Não três.

**C8 · Migration numerada e idempotente.** Próximas: `010_`, `011_`. `if not exists`,
`drop policy if exists` antes de criar.

**C9 · Sem feature flag.** A ordem das migrations é a ordem.

**C10 · Todo teste é puro.** `npm run test` = `vitest run`, sem banco. Logo, a lógica
de cada tarefa mora numa função pura em `lib/`, testada; SQL é validado pelo espelho
TS (mesmo padrão de `lib/pricing.ts` ↔ `create_order`).

## Restrições do projeto

- Next.js 15.1.6, React 19, Supabase via `@supabase/ssr` — nenhuma dependência nova.
- Tailwind 4; classes do DS em `app/_design/`. `app/_design/admin.css` é cópia do
  `styles.css` do cardapio-digital — mudança de design espelha nos dois repos.
- Verificação: `npm run test`, `npm run lint`, `npm run build`.
- Última migration existente: `009_fix_auto_cancel_rowcount.sql`.

## O que fica para o construtor

Nomes de componentes, layout das telas, ordem visual das colunas do kanban, e a
redação final da copy em PT-BR.
