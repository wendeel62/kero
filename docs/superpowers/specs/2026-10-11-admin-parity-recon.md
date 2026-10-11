# Engenharia reversa — admin do cardapio-digital → o que é implantável no kero

Recon, não spec. Nada aqui foi aprovado. Fontes: código dos dois repos.

## Conclusão de topo

A lógica de negócio do admin do cardapio-digital é **fina e portável**. A complexidade
dele está toda em infraestrutura: 2 bancos (`business` + `operations`), Prisma, Express,
middleware de RBAC, `businessId` em toda query. Nada disso é a funcionalidade — é o
pedágio. No kero, quase todo endpoint vira uma query Supabase de 5-30 linhas porque
RLS já faz o isolamento por loja que o `businessId` fazia na mão.

O que **não** é portável: a máquina de estados de pedido. A do kero é mais rígida
(`fn_enforce_order_status_transition`, `002_functions_triggers.sql:154-201`) e o kanban
do cardapio arrasta livre. Ver "Travas" abaixo.

---

## Página por página

### 1. Dashboard (`services/api/src/routes/admin/dashboard.ts:23-156`)

**Lógica real:** busca os pedidos do dia, filtra `status !== 'cancelado'`, soma `total`
→ faturamento. Ticket = faturamento/quantidade. `pedidosPendentes` = `count(status='recebido')`.
`entregasAndamento` = `count(status in [preparando, pronto, saiu_para_entrega])`.
Metas: `SalesGoal` com `dataInicio`/`dataFim` e `tipoPeriodo` (diaria/semanal/mensal);
progresso = `min(faturamento/valor, 1)`. Localização da loja: pino manual lat/lng,
senão geocode do endereço, senão null. Listas: 6 pendentes + 6 últimos.

**Kero já tem:** `getHoje()` (`lib/painel.ts:15-38`) dá count, revenue, ticket, awaiting
e 5 recentes. Falta: `entregasAndamento`, meta, localização da loja.

**Veredito:** barato. 3 contadores e 1 tabela `goals`.

### 2. Pedidos / Kanban (`routes/admin/orders-queue.ts:31-96`, `orders.ts:30`)

**Lógica real:** `GET /` aceita `status`, `tipo`, `de`, `ate`, `limit` (clamp 200),
`offset`. `PATCH /:id/status` valida transição e registra log. Front: 6 colunas
(Novo/Em preparo/Pronto/Saiu p/ entrega/Entregue/Cancelado), drag&drop, filtro por
tipo e por data.

**Kero já tem:** kanban de 5 colunas com avanço por botão
(`app/painel/pedidos/page.tsx:13-33`), `minutesAgo` com destaque vermelho >10 min em
`new`, página de detalhe com linha do tempo, Realtime em `orders`
(`004_realtime_storage.sql:9`).

**O kanban do kero é melhor que o do cardapio em um ponto específico:** `nextStatus`
é ciente do tipo — em `preparing`, retirada vai para `ready` e entrega vai direto
para `out` (`page.tsx:25`), pulando `ready` porque `preparing→out` é permitido pela
máquina de estados. O kanban nunca esbarrou na Trava A; só o "atribuir motoboy"
esbarraria.

> **Drag&drop: fora de escopo por decisão do dono (2026-10-11).** No cardapio-digital
> o card às vezes não pousava na coluna certa. O avanço por botão é uma ação nomeada
> ("Confirmar", "P/ preparo"), não um gesto que pode errar o alvo. Fica como está.

**Falta (só isto):** filtro de período (hoje a janela é fixa: não finalizados + hoje,
`lib/painel.ts:204`), filtro por tipo (Entrega/Retirada), e tempo **no status atual**
(`order_events` já registra cada transição — hoje só há tempo desde a criação).

**Veredito:** barato. Nenhuma trava, nenhuma migration.

### 3. PDV (`routes/admin/pdv.ts:67-233`, `tables.ts` + `services/mesas.ts`)

**Lógica real:** `POST /orders` recebe `{itens, tipo, mesaNumero, cliente}`.
Mesa ocupada → `409 mesa_ja_ocupada` com o `orderId` existente (não cria duplicata).
Delivery exige telefone e endereço. Geocodifica o endereço. Upsert de `customer`
por telefone. Calcula quote (taxa por zona). `listarMesas()` monta 1..`mesasSalao`
com o pedido ativo de cada mesa.

**Kero já tem:** `create_order()` (`002_functions_triggers.sql:309`) faz o trabalho
pesado — recalcula preço no servidor, aplica taxa de bairro, gera código, detecta
`PRICE_CHANGED`.

**Falta:** `orders.type` não aceita mesa (`001_schema.sql:97`), e `create_order` é
`service_role` only (`003_rls.sql:104`) — hoje só a rota pública de checkout chama.

**Veredito:** o mais caro dos "baratos", porque toca schema + RPC + RLS.

### 4. Entregas (`routes/admin/deliveries.ts:60-193`) — SEM MAPA

> **Fora de escopo por decisão do dono (2026-10-11).** A imprecisão de endereço do
> cardapio-digital era do *geocoding*, não do sistema: todo provedor (Mapbox, Google,
> OSM) interpola número de casa a partir do CEP e do trecho da rua — em Manaus, com
> rua sem CEP por trecho, erra sempre. Trocar de provedor não conserta. O kero já
> contorna por outro caminho: `orders.address` guarda `cep` + `neighborhood_id` +
> `reference` (ponto de referência livre, informado pelo cliente, sem geocoding).
> Mapa, pino da loja, Leaflet/Mapbox e autocomplete de endereço: **descartados**.
> O módulo de Entregas continua viável sem coordenada nenhuma — ver abaixo.

**Lógica real (sem a parte de mapa):** `GET /board` = 4 consultas — prontas
(`routeStops: none`), em rota (`status='saiu_para_entrega'` + `routeStops: some`),
concluídas hoje, histórico 30 dias. `POST /assign` valida motoboy ativo e
**não já em rota** (`409 courier_em_rota`), valida pedido elegível, e cria
`Route` + `RouteStop` mudando o pedido para `saiu_para_entrega` numa transação.

**Kero já tem:** nada.

**Falta:** 3 tabelas (`courier`, `route`, `route_stop`). Sem coordenada: o motoboy
recebe endereço em texto + referência, e o histórico é por entregador.

**Veredito:** médio (caiu de caro ao tirar o mapa). Continua travado por A.

### 5. Financeiro (`routes/admin/financeiro.ts:31-419`)

**Lógica real:** `resumo` com período (7/30/90/custom) → bruto (soma `total` sem
cancelados), despesas pagas no período, líquido = bruto − despesas, série diária,
metas detalhadas. Caixa: `abrir` (fundo inicial), `atual`, `movimento` (entrada/saída),
`fechar` (valor contado → diferença). Contas a pagar: CRUD + `POST /:id/pagar`.

**Kero já tem:** nada.

**Falta:** 3 tabelas (`cash_session`, `cash_movement`, `payable_account`) + `goals`.

**Veredito:** médio, mas é o módulo mais "contábil" — o que menos parece delivery.
Nota: o "lucro líquido" dele é bruto − despesas registradas. Não há custo de produto
em lugar nenhum dos dois projetos.

### 6. Cardápio — já copiado pelo usuário

**Diferença estrutural que resta:** o cardapio tem `OptionGroup`/`Option`
(nome, obrigatório, máximo de escolhas, preço extra). O kero tem `product_addons`
plano — global + vínculo por produto (`001_schema.sql:68-77`). Sem grupo, sem
obrigatoriedade, sem limite. É a única lacuna real de modelagem no cardápio.

### 7. Clientes (`routes/admin/customers.ts:12-67`)

**Lógica real:** classificação é literalmente isto —

```
vip        se pedidos > 5  OU gasto >= 500
recorrente se pedidos > 1
novo       caso contrário
```

Agrega por `customerId` com `_count` e `_sum` (excluindo cancelados) + data do
último pedido. Nada mais.

**Kero já tem:** não existe tabela `customers` — nome/telefone vão soltos em `orders`.

**Veredito:** barato. Dá para derivar de `orders` agrupando por `customer_phone`
sem tabela nova. Se quiser edição manual de cliente, aí precisa tabela.

### 8. Configurações — 7 abas vs. 3 do kero

| Aba | Cardapio | Kero |
|---|---|---|
| Loja | nome, logo, endereço, lat/lng, aberto/fechado | **tem** |
| Salão e metas | nº de mesas + metas | falta |
| Horário | por dia da semana | **tem** |
| Entrega | taxa fixa, zonas (CEP range ou polígono) | **tem** — e melhor: bairro + taxa |
| Impressão | host/porta, teste, health check 60s | falta |
| Rastreamento | Meta Pixel, GA4 | falta |
| Equipe | CRUD de logins com papéis | falta |

**Veredito:** "Salão e metas", "Rastreamento" e "Equipe" são baratos. "Impressão"
depende de agente externo.

### 9. Impressora (`routes/admin/printer.ts`, `agent.ts`)

Agente que fala com impressora térmica de rede, health check a cada 60s.
O kero já tem a comanda em `app/painel/pedidos/[id]/print`. Imprimir sem clique
exige um agente rodando na rede da loja — infra que o kero não tem.

### 10. Equipe (`routes/admin/users.ts`)

Papéis: `owner`, `manager`, `kitchen`, `attendant`. O kero tem
`profiles.role in ('loja','admin')` (`001_schema.sql:32`) — um papel de lojista só.

---

## Travas do kero (o que quebra se ignorar)

**A. Máquina de estados é mais rígida que o kanban do outro** —
`002_functions_triggers.sql:167-175`: `new→confirmed→preparing→ready|out→delivered`.
Não existe `new→preparing`, não existe `ready→out`. O cardapio arrasta "Novo"
direto para "Em preparo" — no kero isso levanta `INVALID_TRANSITION`.

**Isto NÃO afeta o kanban do kero**, que avança por botão e passa por `confirmed`
(`page.tsx:25`). Afeta o "atribuir motoboy": o assign do cardapio move o pedido
para `saiu_para_entrega` a partir de `recebido`/`pronto`, e no kero não existe
`ready→out`. Duas saídas: o assign só aceita pedido já em `out`, ou a máquina
ganha `ready→out`. A primeira não toca no coração do pedido — preferível.

**B. `orders.type` só aceita `delivery|pickup`** (`001_schema.sql:97`).
Mesa/balcão = migration + `create_order` + RLS + UI do cliente.

**C. `create_order` é `service_role` only** (`003_rls.sql:104`). O PDV no painel
precisa de um RPC próprio ou de reuso — e ele foi desenhado para total vindo do
cliente (detecta `PRICE_CHANGED`).

**D. Realtime só publica `orders`** (`004_realtime_storage.sql:9`). Tabela nova
(entregas, caixa) não chega ao browser sem `alter publication` ou polling.

**E. `UPDATE` em `orders` está restrito a 5 colunas** (`003_rls.sql:96-97`):
status, cancellation_reason, canceled_by, updated_at. "Editar pedido" não é
possível sem migration — é trava desenhada, não esquecimento.

---

## Quadro final

| Feature | Esforço | Depende de |
|---|---|---|
| Filtro de período (7/30/90/custom) | baixo | — |
| Tempo no status atual | baixo | `order_events` (já existe) |
| KPIs extras (entregas em andamento) | baixo | — |
| Meta + donut | baixo | tabela `goals` |
| Clientes com perfil VIP/recorrente/novo | baixo | agregação em `orders` |
| Rastreamento (Pixel/GA4) | baixo | — |
| Equipe com papéis | baixo | migration em `profiles.role` |
| Kanban: filtro período + tipo + tempo no status | baixo | — |
| Complementos com grupos | médio | tabelas novas (grupo + opção) |
| Financeiro: caixa + contas | médio | 3 tabelas |
| PDV + mesas | alto | Travas B e C |
| Entregas + motoboy (sem mapa) | médio | Trava A + 3 tabelas |
| Impressora térmica automática | alto | agente na rede da loja |

## O que nenhum dos dois tem

Custo de produto. Os dois chamam "líquido" de bruto − taxas/despesas registradas.
Quem souber o custo real de cada item mostra margem; ninguém no mercado de delivery
pequeno mostra isso.
