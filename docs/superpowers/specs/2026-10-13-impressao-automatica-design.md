# Impressão automática de pedidos (agente local) — Design

**Data:** 2026-10-13
**Status:** para revisão do dono

## Intent

Hoje imprimir exige uma pessoa: abrir `/painel/pedidos/[id]/print` e clicar em
"Imprimir" (`window.print()`). O kero vai ser autônomo — o pedido nasce de uma IA
no WhatsApp, da vitrine pública ou do PDV, e ninguém está na frente do PC da loja
para clicar. Objetivo: **todo pedido de delivery imprime sozinho**, com o menor
número possível de modos de falha.

A Vercel não enxerga a impressora do restaurante: a impressora USB só é
alcançável localmente. Daí o agente.

**Teto honesto:** a impressão só acontece com o PC da loja ligado e a loja
aberta — não existe pedido fora do turno, por decisão do dono. Com o PC
desligado, o job fica na fila e imprime quando voltar. Nenhuma arquitetura
imprime com a máquina desligada; o que se faz é enfileirar, retentar e **saber
quando não imprimiu**.

## Goals

- Todo `orders` com `type = 'delivery'`, seja qual for a origem (RPC
  `create_order` da vitrine, `pdv_create_order` do PDV, a IA do WhatsApp no
  futuro), gera um job e imprime sem clique.
- Funciona com marca de impressora desconhecida (Epson TM-T20/T30, Elgin i9/Vox,
  Bematech MP-4200 TH, Tanca, Swiss...), via **USB**, sem runtime instalado no PC
  do lojista — um `.exe` único em Go.
- O painel mostra se a impressora está conectada e permite reimprimir qualquer
  pedido da loja com 1 clique (ação humana explícita, inclusive retirada); a
  impressão **automática** é só delivery.
- Falha é visível, nunca silenciosa.

## Non-goals (v1)

- Bobina 58mm, vias separadas (cozinha/entrega), gaveta de dinheiro.
- Impressora de rede por socket direto (porta 9100) — USB via spooler cobre o caso.
- Auto-update do agente (reinstalação manual, instalação assistida pelo dono).
- Agente fora do Windows.
- Impressão automática de pedido que não é delivery (retirada/salão têm gente no
  balcão). A reimpressão manual desses pedidos é permitida.
- QR code, logo ou imagem no cupom.

## Anti-goals

- **Fazer a criação do pedido depender da impressão.** O pedido é aceito mesmo se
  a impressão falhar: perder venda é pior que perder cupom.
- Marcar como impresso antes do spooler aceitar (perda silenciosa).
- O agente falar direto com o banco. Ele é código rodando no PC de terceiros e só
  fala com a API; a API é a fronteira de confiança.

## Constraints

- Stack: Next.js 15 (App Router), Supabase (Postgres), Vercel, Tailwind v4,
  vitest. A Vercel não alcança a impressora do lojista.
- Schema em inglês: `stores`, `orders`, `order_items`; multi-loja por `store_id`
  com RLS (`supabase/migrations/003_rls.sql`). Dinheiro em centavos.
- Migrations sequenciais, sem migration de correção. A próxima é `024`.
- Padrões do repo: rotas em `app/api/*/route.ts` com `apiError`; cliente service
  role via `createAdminClient()` (`lib/supabase/admin.ts`); componentes em
  kebab-case; testes vitest ao lado do módulo.

## Decisões (minhas, o dono pode revisar)

- **Fila `print_jobs` em vez de uma coluna `printed_at`.** O requisito é
  confiabilidade: o claim atômico (`for update skip locked`) impede impressão
  dupla, `attempts` dá retentativa limitada, `status` torna a falha visível no
  painel, e "reimprimir" é só criar um job novo.
- **Cupom ESC/POS gerado no servidor, na hora do claim.** Mudar layout não exige
  reinstalar agente em lojista nenhum, e a reimpressão sempre sai com o layout
  atual. O agente só repassa bytes.
- **Code page configurável por dispositivo** (default `ESC t 3` = PC860, padrão
  Epson). Como não controlamos a marca, a página local do agente tem um teste de
  acentuação que percorre as opções (PC860 / PC850 / CP1252) — é a calibração que
  o hardware real exige.
- **O spooler do Windows é uma camada de retry de graça**: impressora offline ou
  sem papel, o SO segura o job e imprime quando resolver. O `ack` do agente
  significa "spooler aceitou", não "saiu na bobina".
- **Janitor dentro do claim, sem cron**: jobs `pending` com mais de 12h viram
  `expired` na própria rota de claim.
- **Badge de integridade** na lista de pedidos, **só em loja com dispositivo
  pareado e não revogado**: delivery sem job nenhum (trigger não rodou), `pending`
  há mais de 2 min **ou job `error`** fica vermelho. É a camada que diz quando não
  foi 100% — e `error` (5 tentativas esgotadas) é exatamente a falha que "nunca
  silenciosa" exige mostrar.
- **Duplicata é aceitável, perda não**: a janela entre imprimir e dar ack é de
  milissegundos; se o agente cair no meio, o job volta pra fila e imprime de novo.
- **Autostart por `HKCU\...\Run`, não Windows Service** — serviço roda fora da
  sessão do usuário e não enxerga a impressora dele.
- **Token no `config.json`** em `%APPDATA%\Kero` (Gerenciador de Credenciais fica
  pra depois); no banco só o `sha256` do token.
- **Agente com ícone na bandeja** (status, abrir configurações, sair) — é o único
  handle visível de um processo headless.
- **Token revogado (401) para o worker**: para de fazer polling e não retenta —
  401 não melhora sozinho. Bandeja e página local mostram "desconectado" com
  botão de reparear.
- **Primeira execução sem navegador**: o menu da bandeja tem "Abrir
  configurações" e mostra a URL `127.0.0.1:porta`; a URL também vai pro log.
- **O botão "Imprimir" da página do cupom continua** como fallback manual.
- **Download do `.exe` por `public/` na Vercel**, com botão na área da impressora.
  O build é um script (`scripts/build-agent.sh`) que cross-compila do Linux e
  copia para `public/kero-agent.exe`, que **vai commitado** (a Vercel só publica
  o que está no git). Ceiling: cada versão nova engorda o repo em ~6 MB — quando
  o agente passar a atualizar com frequência, muda para GitHub Releases.
- **Sem coluna `via` na v1.** Vias (cozinha/entrega) ficam para a Fase 2 por
  decisão do dono; acrescentar a coluna depois é migration sequencial normal, não
  corretiva — não precisa nascer agora.
- **Polling de 5s só com a loja aberta, 30s fechada — e falha-aberta.** O
  heartbeat devolve `open` (reusando `fn_store_is_open`, que já existe em `002:76`)
  e o agente só muda o intervalo; o claim **nunca** é bloqueado, e se o flag vier
  ausente ou estranho o agente assume aberto (5s). Gatear o *claim* pelo horário
  criaria um modo de falha novo — horário mal cadastrado = nada imprime — para
  economizar centavos. Custo de referência: 5s incondicional = ~518 mil invocações
  serverless/mês por loja; com o intervalo gateado cai ~40%.
- **Rate limit em `/api/agent/pair`** (por IP), como o `create_order` já faz.
- **Heartbeat devolve a versão mais recente** do agente; o painel marca
  "atualização disponível" quando o `agent_version` do dispositivo é menor. Sem
  auto-update, é assim que o dono sabe quais lojas revisitar.
- **Aviso de SmartScreen no painel**: `.exe` sem assinatura dispara "Windows
  protegeu o PC"; a área da impressora traz o texto de ajuda ("Mais informações →
  Executar assim mesmo"). Assinatura de código fica para a Fase 2.

## Modelo de dados — `supabase/migrations/024_auto_print.sql`

```sql
create type print_status as enum ('pending','printing','done','error','expired');

create table print_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  order_id uuid not null references orders on delete cascade,
  status print_status not null default 'pending',
  attempts int not null default 0,
  error text,
  claimed_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on print_jobs (store_id, status, created_at);

create table pairing_codes (
  code text primary key,               -- ex.: 'K7F92Q', 10 min, uso único
  store_id uuid not null references stores on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table agent_devices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  token_hash text not null unique,     -- sha256 do token; o token só existe no PC
  printer_name text,
  codepage int not null default 3,     -- ESC t n (3 = PC860)
  agent_version text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
```

- **Trigger** `after insert on orders` criando o job **quando `type = 'delivery'`
  e existe dispositivo pareado e não revogado** para a loja. A origem do pedido
  segue irrelevante (vitrine, PDV, IA). O filtro de dispositivo evita fila
  fantasma: sem ele, todo delivery de loja que nunca conectou impressora virava
  `pending` e acendia o badge vermelho para sempre.
- **`claim_print_job(p_store_id)`** — `security definer`, marca `> 12h pending`
  como `expired` e depois reivindica um job com
  `status = 'pending' or (status = 'printing' and claimed_at < now() - 60s)`,
  `attempts < 5`, `order by created_at`, `for update skip locked`.
- **RLS** nas três tabelas, no padrão multi-loja do `003`: o lojista lê os jobs e
  as configurações da própria loja; quem escreve job é o trigger/RPC.

## API

| Rota | Quem chama | Auth | O que faz |
|---|---|---|---|
| `POST /api/agent/pair` | agente | código de pareamento | troca o código por um token de dispositivo (devolvido uma vez) |
| `POST /api/agent/claim` | agente, a cada 5s | Bearer token | reivindica um job e devolve o cupom em base64 (204 se vazio) |
| `POST /api/agent/ack` | agente | Bearer token | `done` (grava `printed_at`) ou `error` (volta pra fila ou vira `error`) |
| `POST /api/agent/heartbeat` | agente, a cada 30s | Bearer token | atualiza `last_seen_at`, versão e nome da impressora |
| `POST /api/print/pairing-code` | painel | sessão do lojista | gera código de uso único válido por 10 min |
| `POST /api/print/reprint` | painel | sessão do lojista | cria um job novo para um pedido existente |
| `POST /api/print/disconnect` | painel | sessão do lojista | preenche `revoked_at` do dispositivo |

- Pareamento: o `update` condicional (`is('used_at', null)` + `gt('expires_at', now)`)
  é atômico — só uma requisição gasta o código.
- Auth do agente: `sha256` do Bearer → busca device com `revoked_at is null`.
- Rotas do agente usam `createAdminClient()` (service role), como
  `app/api/orders/route.ts`.

## Cupom — `lib/print/escpos.ts`

- 48 colunas (80mm), CP860 por default, code page vindo do dispositivo.
- Conteúdo espelha o cupom HTML que já existe
  (`app/painel/pedidos/[id]/print/page.tsx`): nome da loja, `#code`, tipo,
  cliente, telefone, endereço com complemento e referência, itens com adicionais
  e observações, subtotal, entrega, total, forma de pagamento e troco, link de
  rastreio. O bloco de endereço só existe quando `type = 'delivery'`.
- Bytes: `ESC @` (init), `ESC t n` (code page), `ESC a n` (alinhamento),
  `GS ! n` (fonte dupla no cabeçalho), `GS V 66 0` (corte parcial).
- Texto fora do code page (emoji) vira `?`; quebra de linha na largura da coluna.

## Agente — `agent/` (Go, novo)

`.exe` único, sem dependências. Build do Linux:
`GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -H=windowsgui" ./cmd/agent`.

```
cmd/agent/main.go        instância única, bandeja, worker
internal/api/            cliente HTTP: pair, claim, ack, heartbeat
internal/printer/        lista impressoras do Windows e imprime RAW pelo spooler
internal/config/         config.json em %APPDATA%\Kero
internal/ui/             servidor 127.0.0.1 + página embutida (go:embed)
internal/tray/           ícone e menu da bandeja
```

- 1ª execução: sem `config.json` → sobe servidor em `127.0.0.1`, abre o navegador,
  o lojista digita o código do painel, escolhe a impressora e roda o teste.
- Worker: `claim` a cada 5s (204 = espera), decodifica base64, imprime RAW,
  `ack`. Erro de rede = backoff exponencial até 30s; 401 = para e pede reparear.
- `heartbeat` a cada 30s; bandeja mostra conectado / erro / sem token.
- Bibliotecas: `github.com/alexbrainman/printer` (RAW pelo spooler),
  `fyne.io/systray` (bandeja), `golang.org/x/sys/windows` (instância única,
  autostart), `golang.org/x/text/encoding/charmap` (teste de acentuação).

## Painel

- **Área "Impressora" em `/painel/configuracoes`** (nova aba, ao lado de loja /
  horários / entrega / salão / rastreamento): status conectada/offline por
  `last_seen_at`, botão "Conectar impressora" que mostra o código com contagem
  regressiva, lista de dispositivos com "Desconectar", botão de download do
  agente.
- **Badge na lista de pedidos** (só em loja com dispositivo pareado): delivery
  sem job, job `pending` há mais de 2 min ou job `error`, marcado em vermelho;
  "Reimprimir" por pedido.

## Riscos conhecidos

- **RAW pelo spooler pode ser recusado por driver proprietário.** O agente escreve
  ESC/POS cru via `StartRawDocument`; a maioria das térmicas de PDV aceita, mas
  algum driver (aparece em Bematech e Tanca) pode não repassar. Mitigação: o teste
  de impressão na instalação — que é assistida pelo dono, então a incompatibilidade
  aparece no install, não às 3h da manhã. Escape hatch se acontecer: modo "driver"
  (o agente renderiza o cupom e manda pelo driver normal, ao custo de o layout
  passar a viver no agente) — Fase 2, só se o teste acusar.
- **Impressora de rede com IP fixo não é coberta** na v1 (só USB via spooler).
- **Cupom lido antes dos itens existirem — verificado, não acontece.** O cupom é
  montado no claim e lê `order_items`; os dois caminhos de criação
  (`create_order`, `002:309`, e `pdv_create_order`, `016:5`) inserem pedido e
  itens dentro da mesma função, logo da mesma transação. O trigger dispara dentro
  dela e o job só fica visível depois do commit, quando os itens já estão
  gravados. **Constraint para o futuro:** quem criar pedido (a IA do WhatsApp)
  precisa gravar pedido e itens na mesma transação, senão o claim passa a precisar
  de um atraso de segurança.
- **Loja aberta fora do horário cadastrado**: o agente continua imprimindo. O
  intervalo é gateado pelo horário, o claim não.

## Verificação

- **Banco**: dois claims concorrentes não pegam o mesmo job; trigger cria job em
  `delivery` e não em `pickup`; janitor expira `pending > 12h`.
- **Cupom**: golden test vitest em `lib/print/escpos.test.ts` — bytes exatos (hex)
  de um pedido conhecido com acento em CP860.
- **Hardware real**: imprimir o cupom de teste na impressora física do dono e
  conferir acento, largura e corte. Sem isso, a calibração de code page é chute.
- **Navegador**: gerar o código no painel, parear, ver "conectada", reimprimir um
  pedido.
- **Loja sem agente**: delivery em loja sem dispositivo não cria job e não acende
  o badge.
- **Pareamento**: rate limit corta rajada de tentativas; código já usado ou
  expirado não pareia duas vezes.

## O que fica para o builder

- Lista exata de colunas, índices e policies RLS (ajustar ao padrão do `003`).
- Layout fino do cupom (espaçamentos, alinhamento de itens e adicionais).
- Design visual da área da impressora nas configurações.
- Divisão interna dos arquivos Go e o texto da página local.

## Fase 2 (fora deste plano)

Vias cozinha/entrega, bobina 58mm, gaveta, impressora de rede direta,
CloudPRNT/ePOS, auto-update do agente, QR code de rastreio no cupom, Gerenciador
de Credenciais do Windows, agente para macOS/Linux, modo "driver" se o RAW falhar.
