# Plano de implementação — IA de atendimento no WhatsApp (WAHA + n8n)

**Data:** 2026-10-17
**Ambiente:** dev primeiro (`.env.local`). Vercel só no final, após validar tudo local.
**Para:** a IA que vai escrever o código. Leia inteiro antes de começar.

---

## 0. Antes de escrever qualquer linha

Você vai mexer num SaaS de delivery em produção. Este plano existe para você não
se perder e não quebrar o que já funciona. Três regras valem mais que qualquer
tarefa:

1. **Não mexa em `create_order`, `pdv_create_order` nem no checkout público.** Você
   vai *chamar* `create_order`, nunca alterá-lo. A migration nova é um wrapper.
2. **Toda mudança passa pelo padrão do repo.** Antes de escrever um arquivo novo,
   leia um irmão dele e copie o formato. Os caminhos estão indicados em cada task.
3. **Toda task termina com verificação.** Não diga "pronto" sem rodar o comando.

### Fatos do schema (verificados — não adivinhe)

- Migrations são **sequenciais e sem correção**. A última é `028_geocode_origem.sql`.
  A sua é **`029_ai_create_order.sql`**.
- `create_order(p_store_id, p_type, p_payment_method, p_change_for_cents, p_notes,
  p_address, p_items, p_total_cents, p_ip, p_customer_name, p_customer_phone)`
  → `returns uuid` (o **tracking_token**, não o id). `p_ip` é `text`.
- `p_items` é `[{id: uuid, qty: int, addons: [uuid], notes: text}]`.
- `p_address` (delivery) é `{street, number, complement, reference, cep,
  neighborhood_id}` — **cep com 8 dígitos, sem traço**. O RPC injeta
  `neighborhood_name` sozinho; a IA **não** envia esse campo.
- `type` ∈ `delivery | pickup`. `payment_method` ∈ `cash | pix | card_machine`.
- `create_order` **recalcula o preço no servidor**. O `p_total_cents` que a IA manda
  só serve para detectar mudança de preço (`PRICE_CHANGED`). Se a IA errar a conta,
  o banco corrige — não grave valor calculado por IA como verdade.
- Erros que a IA pode tomar (códigos crus): `RATE_LIMIT`, `DUPLICATE`,
  `STORE_CLOSED`, `ADDRESS_REQUIRED`, `INVALID_CEP`, `NEIGHBORHOOD_INVALID`,
  `BAIRROS_NAO_CONFIGURADOS`, `PRICE_CHANGED`, `INVALID_PHONE`, `EMPTY_CART`.
- `products` = `{id, store_id, name, description, price_cents, active}`.
- `product_addons` = `{id, store_id, product_id, name, price_cents, active}`
  (`product_id` null = global).
- `neighborhoods` = `{id, store_id, name, fee_cents, active}`.
- `stores` tem `open_hours` (jsonb), `pix_key`, `whatsapp`, `slug`, `force_closed`.
- `lib/wa.ts` **já tem `waLink(phone, text)`** — não escreva um gerador de link wa.me.
- `lib/store-hours.ts` **já tem `isStoreOpen(hours)` e `nextOpeningLabel(hours)`**
  (fuso America/Manaus, espelha o SQL). Use, não reescreva.
- `lib/api-errors.ts` tem `apiError(code, message, status)` e `mapOrderError(msg)`.
- `lib/auth.ts` tem `requireStore()` (server component, redireciona) e
  `requireStoreApi()` (rota API, devolve `null`).
- `lib/supabase/admin.ts` tem `createAdminClient()` — service role, **só server**.

### Helpers que já existem e você DEVE reaproveitar

| Precisa | Use | Não escreva |
|---|---|---|
| Link WhatsApp | `waLink()` de `lib/wa.ts` | gerador de link novo |
| Loja aberta / "abrimos às X" | `isStoreOpen()`, `nextOpeningLabel()` | parse de `open_hours` |
| Erro de API | `apiError()`, `mapOrderError()` | formato `{error:{code,message}}` novo |
| Client service role | `createAdminClient()` | cliente Supabase novo |
| Guard da rota | `requireStoreApi()` | checagem de sessão nova |

### API do WAHA (verificada na doc, engine GOWS)

Header `X-Api-Key` em tudo.

| Chamada | Endpoint |
|---|---|
| Criar sessão | `POST /api/sessions` |
| Pegar QR | `GET /api/{session}/auth/qr` (com `Accept: application/json` → base64) |
| Status | `GET /api/sessions/{name}` |
| Enviar texto | `POST /api/sendText` `{session, chatId, text}` |
| Desconectar | `DELETE /api/sessions/{name}` |

Status possíveis: `STOPPED`, `STARTING`, `SCAN_QR_CODE`, `WORKING`, `FAILED`,
`PASSKEY_REQUIRED`. O QR **expira e é reemitido** — o frontend precisa pollar.

Payload do webhook `message`:
```jsonc
{ "event": "message", "session": "kero_<store_id>",
  "metadata": { "store_id": "<uuid>" },
  "payload": { "id": "...", "timestamp": 123, "from": "5511999@c.us", "body": "oi" } }
```
`metadata` volta em **todo** webhook — é o que garante o isolamento entre lojas.

---

## Task 1 — Migration `029_ai_create_order.sql`

**Arquivo:** `supabase/migrations/029_ai_create_order.sql` (novo)
**Lê antes:** `supabase/migrations/013_addon_group_enforcement.sql` (é a versão
atual da `create_order`)

Escreva um wrapper que **delega** para `create_order`. Não copie os 200 linhas —
se você copiar, a próxima mudança na `create_order` não chega na IA e as duas
divergem em silêncio.

```sql
-- 029_ai_create_order.sql — RPC de pedido para a IA do WhatsApp.
-- Delega para create_order (013) e só neutraliza o rate limit por IP: a IA não
-- é um checkout público e não conhece o IP real de quem mandou a mensagem.
-- O dedup de 60s (mesmo telefone) continua valendo e evita pedido duplicado.
-- Validação, recálculo de preço e transação única vêm da create_order.
create or replace function ai_create_order(
  p_store_id uuid,
  p_type text,
  p_payment_method text,
  p_change_for_cents integer,
  p_notes text,
  p_address jsonb,
  p_items jsonb,
  p_total_cents integer,
  p_customer_name text,
  p_customer_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  return create_order(
    p_store_id, p_type, p_payment_method, p_change_for_cents, p_notes,
    p_address, p_items, p_total_cents,
    'ai:' || p_store_id::text || ':' || p_customer_phone,
    p_customer_name, p_customer_phone
  );
end;
$$;

revoke execute on function ai_create_order(uuid, text, text, integer, text, jsonb, jsonb, integer, text, text) from public, anon, authenticated;
grant  execute on function ai_create_order(uuid, text, text, integer, text, jsonb, jsonb, integer, text, text) to service_role;
```

O `p_ip` sintético (`ai:<store>:<telefone>`) é determinístico: dois pedidos do
mesmo telefone na mesma hora caem no `DUPLICATE` da `create_order` — que é
exatamente a proteção que queremos.

**Verificação:**
```bash
npx supabase db push   # ou o comando que o repo usa
```
Depois, no SQL Editor do Supabase, confirme que a função existe:
```sql
select proname from pg_proc where proname = 'ai_create_order';
```
E que 10 pedidos seguidos da mesma loja **não** tomam `RATE_LIMIT`.

---

## Task 2 — `lib/waha.ts` (cliente WAHA)

**Arquivo:** `lib/waha.ts` (novo)
**Lê antes:** `lib/supabase/admin.ts` (para o padrão de "server-side only")

Cinco funções e nada mais. Sem classe, sem wrapper de retry, sem cache.

```ts
// Cliente WAHA (GOWS). Server-side only: X-Api-Key é segredo.
// ponytail: sem retry — a página do painel reconecta no próximo poll.
```

- `sessionName(storeId: string)` → `` `kero_${storeId}` ``. **O nome da sessão é
  derivado do `store_id`, nunca vem do corpo da requisição.**
- `criarSessao(storeId, webhookUrl)` → cria com `config.metadata = { store_id }`
  e `config.webhooks = [{ url: webhookUrl, events: ["message"], retries: {...} }]`,
  engine `GOWS`. **`name` sempre explícito** — omitir faz o WAHA gerar
  `session_…` aleatório. Se já existir (400/409), faça `GET` do status em vez de
  falhar.
- `statusSessao(session)` → `{ status, me }`
- `qrCode(session)` → base64 (envia `Accept: application/json`)
- `enviarTexto(session, chatId, text)`
- `desconectar(session)` → `DELETE`

`WAHA_URL` e `WAHA_API_KEY` vem de `process.env`. Se faltarem, **lance erro
claro** — não faça fetch com `undefined`.

**Verificação:** `lib/waha.test.ts` novo, com `fetch` mockado (veja
`lib/painel-utils.test.ts` para o estilo). Teste que `sessionName` é estável e que
uma resposta 409 em `criarSessao` cai para o status, não explode.

---

## Task 3 — Rotas API `/api/whatsapp/*`

**Arquivos:** `app/api/whatsapp/status/route.ts`, `connect/route.ts`, `qr/route.ts`,
`disconnect/route.ts` (novos)
**Lê antes:** `app/api/orders/route.ts` (padrão de rota + `apiError`)

Toda rota começa com:
```ts
const s = await requireStoreApi();
if (!s) return apiError("UNAUTHORIZED", "Não autenticado.", 401);
const storeId = /* do profile, nunca do body */;
```

| Rota | Método | O que faz |
|---|---|---|
| `/api/whatsapp/status` | GET | status da sessão + número conectado |
| `/api/whatsapp/connect` | POST | cria a sessão com o webhook do n8n |
| `/api/whatsapp/qr` | GET | QR em base64 (poll do frontend) |
| `/api/whatsapp/disconnect` | POST | `DELETE` na sessão |

**`store_id` nunca vem do corpo em nenhuma rota.** Só do profile autenticado. Se
você precisar de `force_closed` ou qualquer coisa da loja, leia do banco.

**Verificação:** `tests/whatsapp-api.test.ts` — 401 sem sessão; status de loja A
nunca reflete loja B.

---

## Task 4 — Página do painel

**Arquivos:** `app/painel/whatsapp/page.tsx` (novo),
`app/painel/shell.tsx` (editar)
**Lê antes:** `app/painel/configuracoes/page.tsx` (estrutura e tokens visuais)

`shell.tsx`: em `GRUPOS`, no grupo **Gestão**, adicione
`{ href: "/painel/whatsapp", label: "WhatsApp", icon: MessageCircle }` —
`MessageCircle` já vem do `lucide-react`, que é dependência. **Não invente SVG.**

A página tem três estados, e só três:

1. **Desconectado** — explicação curta + botão "Conectar WhatsApp".
2. **Conectando** — QR em `<img src={dataUrl}>`, poll `/api/whatsapp/qr` a cada 2s.
   O QR expira: se o poll devolver erro, volte ao estado 1.
3. **Conectado** — número, status, botão "Desconectar".

Use os tokens do design system: `var(--surface)`, `var(--border)`, `var(--muted)`,
`var(--red)`. Mobile-first, como as outras páginas.

**Verificação:** `npm run build` passa e a página renderiza os 3 estados.

---

## Task 5 — Tools do n8n (o que a IA enxerga)

**Arquivo:** o workflow do n8n (Task 6) — as tools são HTTP Request nodes.
**Lê antes:** nada no repo; ver as regras abaixo.

Cada tool é um HTTP Request para o PostgREST do Supabase usando o service role.
**Toda query filtra por `store_id` vindo do `metadata` do webhook — nunca do
corpo, nunca da conversa.**

| Tool | Query | Devolve |
|---|---|---|
| `cardapio_loja` | `products?store_id=eq.$STORE&active=eq.true&select=name,price_cents,description` + `product_addons` | itens e preços |
| `consultar_entrega` | `neighborhoods?store_id=eq.$STORE&active=eq.true&select=name,fee_cents` | bairros e taxa |
| `forma_pagamento` | `stores?id=eq.$STORE&select=name,pix_key,open_hours,slug,force_closed` | nome, pix, horário |
| `ultimo_pedido` | `orders?store_id=eq.$STORE&customer_phone=eq.$PHONE&order=created_at.desc&limit=1` | endereço anterior |
| `criar_pedido` | POST RPC `ai_create_order` | tracking_token |

`$STORE` vem do `metadata.store_id` do webhook, passado por expressão. `$PHONE`
veio do `payload.from` do WAAPI (tire o `@c.us`).

**Erro do `criar_pedido`:** cada código de erro tem uma resposta em português
para o cliente. `STORE_CLOSED` → "fechamos às X". `DUPLICATE` → "já registrei seu
pedido". ** Nunca deixe o erro cru vazar para o cliente.**

---

## Task 6 — Workflow n8n

**Ordem dos nós** (as lições de engenharia vêm do caso real — não pule nenhuma):

1. **Webhook** (evento `message` do WAHA)
2. **If** — `payload.fromMe == false`. Sem isso a IA conversa com ela mesma.
3. **Wait** — **10 segundos**. Cliente manda "oi" / "quero um" / "marge" em
   mensagens separadas; sem o Wait a IA responde cada uma e a experiência quebra.
4. Switch — imagem / áudio / texto. Imagem e áudio: resposta fixa pedindo para
   digitar. Só texto segue.
5. **AI Agent** (modelo + tools da Task 5 + memória Postgres) com o prompt abaixo.
6. **Code** — limpa o texto: remove `**`, `##`, `-` de lista, `---`. Markdown
   vira lixo no WhatsApp.
7. **HTTP Request** — `POST /api/sendText` com `{session, chatId, text}`.

Use a **calculadora nativa do n8n** para a conta (a IA erra "3 × 5").
Configure retry no webhook: o WAHA reenvia e um 500 seu duplica resposta.

### O prompt do agente

```text
Você é a {nome_da_loja}, assistente virtual de atendimento da loja.

ESCOPO — regra mais importante:
Você atende SOMENTE sobre o estabelecimento: cardápio, preços, itens,
combos, entrega, bairros, taxa, formas de pagamento e horário de funcionamento.
Se o cliente perguntar qualquer outra coisa, diga com clareza e educação que
você só consegue ajudar sobre a loja, e convide a consultar o cardápio.

COMO ATENDER:
1. Na primeira mensagem, cumprimente pelo nome da loja e envie o link do
   cardápio: {link_vitrine}
2. Registre cada item no resumo e confirme com o cliente a cada etapa.
3. Sempre confirme o pedido antes de finalizar, para reduzir erros.

AUMENTANDO O PEDIDO (faz parte do seu trabalho):
Depois que o cliente escolher os itens, se o pedido não tiver batata ou
bebida, ofereça uma — a maioria dos clientes não pede por conta própria.

DADOS DO PEDIDO:
- Itens: sempre consulte a ferramenta cardapio_loja. NUNCA invente preço.
  Se o item não existir no cardápio, diga que não temos.
- Entrega: consulte consultar_entrega para saber se delivery no bairro é
  possível e a taxa. Antes de montar o pedido, verifique se a loja está
  aberta com forma_pagamento — se estiver fechada, avise o horário e pare.
- Endereço: use ultimo_pedido. Se já houver um pedido anterior, pergunte
  "vai ser nesse mesmo endereço?" antes de pedir de novo.
- Pagamento: pergunte sempre. Se for dinheiro, pergunte SEMPRE se vai precisar
  de troco e de quanto.

FINALIZANDO:
Confirme o pedido, chame criar_pedido, agradeça e informe que o pedido foi
registrado. Uma mensagem por bloco, texto simples, sem formatação.
```

O `{nome_da_loja}`, `{link_vitrine}` e `$STORE` vêm do metadata/banco — não
escreva none hardcoded. O `link_vitrine` se monta com `waLink`-style:
`NEXT_PUBLIC_APP_URL` + `/` + `slug`.

---

## Task 7 — Configurar o n8n (passo a passo, na sua máquina)

1. Suba o WAHA com engine GOWS e anote **URL base** e **API key**.
2. No n8n, crie a credential do Supabase com a **service_role** (host, chave).
3. Crie a credential do seu modelo de IA.
4. Monte os nós na ordem da Task 6.
5. Crie o workflow de webhook e **ative-o** (o webhook do n8n só funciona ativo).
6. Copie a URL do webhook — é o que o WAHA vai chamar.

---

## Task 8 — `.env.local` e verificação ponta a ponta

**Já configurado em `.env.local` (verificado ao vivo em 2026-10-17):**
```
WAHA_URL=http://localhost:3100
WAHA_API_KEY=<chave da instância local>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

O `.env.example` tem as três chaves com valor de placeholder. **Nunca commite
`.env.local`.**

> **Verificado contra a instância real:** `GET /api/sessions` responde `[]` e
> exige `X-Api-Key` (401 sem ela). O `POST /api/sessions` com body `{}` **cria**
> a sessão e gera nome automático (`session_01m55r…`) — então **sempre envie
> `name` explícito**, nunca confie em geração automática, e limpe a sessão se
> criar uma de teste (`DELETE /api/sessions/<name>`).
> `GET /api/about` e `/api/engines` **não existem** (404) — nãocodifique contra
> eles; a versão/engine se lê de `GET /api/sessions/{name}`.

Checklist de validação, **nesta ordem**:

- [ ] `npm run build` sem erro
- [ ] `npx vitest run` verde
- [ ] Lojista abre `/painel/whatsapp`, vê o QR, escaneia com o celular
- [ ] Status vira "conectado" e mostra o número
- [ ] Mandar "oi" no WhatsApp → a IA responde com saudação + link do cardápio
- [ ] Mandar 3 mensagens seguidas ("oi" / "quero uma pizza" / "de calabresa")
      → **uma** resposta só, depois de ~10s
- [ ] Fechar pedido completo → pedido aparece em `/painel/pedidos` com itens
      e valores **corretos** (o banco recalcula)
- [ ] Mandar pergunta fora do assunto ("quem é o presidente") → ela recusa
      educadamente
- [ ] Pedir algo que não existe no cardápio → ela diz que não tem
- [ ] **Isolamento:** loja A conectada, loja B conectada; mandar mensagem na A
      não responde na B
- [ ] Forçar 6 pedidos seguidos na mesma loja → **não** toma `RATE_LIMIT`

---

## Task 9 — Só depois: subir para a Vercel

Quando **todos** os itens da Task 8 passarem:

1. `vercel env add WAHA_URL` e `vercel env add WAHA_API_KEY` (Production +
   Preview). **A key nunca vai pro repo.**
2. `NEXT_PUBLIC_APP_URL` = o domínio real (o link do cardápio depende disso).
3. Se o WAHA estiver atrás de auth/TTPS, a Vercel precisa alcançar — teste antes.
4. `vercel --prod` e repita o checklist da Task 8 em produção.

---

## Ordem de execução

1 → 2 → 3 → 4 (painel funciona, QR conecta) → 7 → 8 (n8n) → 5/6 (IA)
→ 8 de novo (validar a IA) → 9 (produção)

Não faça 9 antes de 8 inteiro. Um webhook de IA em produção sem o isolamento
testado é o jeito mais rápido de uma loja responder pela outra.

---

## Armadilhas conhecidas

1. **Isolamento entre lojas** é a coisa mais importante e a mais fácil de quebrar.
   O `store_id` vem do `metadata` do webhook e é propagado para as tools. Se em
   algum momento uma tool aceitar `store_id` do corpo, uma loja responde pela
   outra. Revise isso com mais cuidado que o resto.
2. **`metadata` não é validação.** Ele volta do WAHA, e o WAHA é seu. A garantia
   real de que a sessão é da loja X é o **nome** da sessão (`kero_<store_id>`),
   derivado do profile autenticado. Use o nome como fonte, e o metadata como
   convenience.
3. **QR expira.** Poll mal feito = tela morta. Trate erro do poll como "volte ao
   estado desconectado".
4. **`DUPLICATE` vai aparecer** em teste: dois pedidos seguidos do mesmo telefone
   na mesma hora. Isso é o dedup funcionando, não um bug.
5. **Preço:** nunca deixe a IA mandar o total como verdade. O banco recalcula.
6. **Markdown no WhatsApp** sai como `**preço**` cru. O nó Code da Task 6 existe
   por isso.
7. **A loja fechada** é recusada pelo banco com `STORE_CLOSED`. A IA precisa
   avisar o horário *antes* de tentar gravar, senão o cliente fica sem resposta.