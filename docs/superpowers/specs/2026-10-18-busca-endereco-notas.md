# Notas — captura de endereço do cliente final (IA no WhatsApp)

**Status:** debate em aberto — continuar em outra sessão.
**Escopo:** SÓ a captura do endereço de entrega do fluxo de IA do WhatsApp. O resto do fluxo fica na sessão de workflow.

## Restrição dura (verificada no repo)

- Pedido de **entrega** exige, no banco: `neighborhood_id` (da lista da loja) **e** `cep` de 8 dígitos.
  - `create_order` (`013_addon_group_enforcement.sql`, ~linhas 104-118): `BAIRROS_NAO_CONFIGURADOS`, `ADDRESS_REQUIRED`, `INVALID_CEP`, `NEIGHBORHOOD_INVALID`.
  - A **taxa de entrega sai do bairro** (`neighborhoods.fee_cents`).
- `orders.address` jsonb = `{street,number,complement,reference,cep,neighborhood_id,neighborhood_name}`.
  O RPC só faz `jsonb_set` de `neighborhood_name` — **aceita chaves extras**, então dá para guardar `lat/lng` do pino sem migration de coluna.

## Como a busca funciona hoje

`lib/geocode.ts` + `app/api/geo/reverse/route.ts`:

- **BrasilAPI** — CEP → logradouro/bairro + centroide.
- **LocationIQ** — endereço → coordenada (desempata rua homônima pelo bairro).
- **Nominatim** — `/api/geo/reverse?lat&lng` → `display_name` (texto). Usado no botão "usar localização" da vitrine (`app/[slug]/checkout.tsx`).
- A vitrine pede CEP + rua + bairro (select da lista); o pino é opcional.

## Evidências testadas (2026-10-18)

### Reverso — Nominatim (`format=jsonv2&addressdetails=1`)

- **Manaus** (3 pontos): bairro **certo** (Centro, Parque Dez de Novembro, Chapada); CEP **genérico `69000-000` nos três**; `house_number` sempre nulo.
- **Fora de Manaus** (7 cidades): bairro certo **e** CEP real — SP `01310-200`, Rio `22041-001`, BH `30130-138`, Curitiba `80020-110`, Salvador `44150-050`, Recife `50040-911`, Belém `66035-385`.
- Conclusão: **Manaus é a exceção no CEP**; o resto do Brasil vem completo. Não precisa de caso especial — só não assumir que o CEP do reverso é bom.

### ViaCEP — busca por rua (`/ws/{UF}/{cidade}/{rua}/json/`)

- Manaus "Rua Silva Ramos" → **2 CEPs reais**: `69010-180` e `69025-030` (Centro). Corrige o genérico do Nominatim.
- "Avenida Paulista" → resposta **não-JSON** (rua comum demais). Falha.
- **Não tem endpoint por coordenada**: `/ws/-3.11/-60.02/json/` → **400**.
- Nunca devolve **número**.

## Proposta em debate

`pino (WhatsApp)` → **reverso** (Nominatim) tira **rua + bairro** → **ViaCEP** busca o **CEP real** pela rua → se o ViaCEP falhar, cai no CEP do reverso. O **número** a IA pergunta. O pino também vai pro motoboy (guardar `lat/lng` no `address`).

Caveats: ViaCEP pode devolver **vários** CEPs (trechos) e falha em rua comum; se cair, **não travar a venda**.

## Perguntas abertas

1. Fechado o desenho "cliente manda pino + número, IA não pede CEP"? (CEP = o real do ViaCEP, ou o genérico do reverso como fallback)
2. Quando o ViaCEP devolve vários CEPs, qual usar? (primeiro? cliente escolhe? desempatar pelo número?)
3. O bairro do reverso casa com a lista da loja por nome? Precisa de match aproximado ("Parque 10" vs "Parque Dez de Novembro") — a IA faz essa costura?
4. Bairro fora da lista = "não entregamos no seu bairro"? (é a fronteira da área de entrega)

## Achado adjacente (escala nacional)

- `America/Manaus` está **hardcoded** (SQL: `daily_salt`, índice único do código do pedido, `is_store_open`; e `lib/store-hours.ts`). Num SaaS nacional, horário de funcionamento e virada de dia saem errados fora do AM. Pré-existente, fora deste fluxo.

## Não verificado

- Se o WAHA entrega o pino como `{lat,lng}` no webhook `message` (a doc cita `location`; confirmar no payload real).
- Precisão do ViaCEP em rua com acento/abreviação.
