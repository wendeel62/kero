# Mapa de entregas com endereço preciso (LocationIQ) — Design

**Data:** 2026-10-12
**Status:** aprovado (escopo fechado com o dono)

## Intent

O kero entrega hoje sem nenhuma coordenada: `orders.address` guarda só
`{street, number, complement, cep, neighborhood_id, neighborhood_name}`. O admin
não vê onde estão as entregas e o motoboy não recebe um ponto confiável. A dor
original vem do cardapio-digital, cujo geocoder (Nominatim público sobre OSM)
errava rua/CEP com frequência.

Objetivo: **coordenada confiável por pedido**, com um mapa de leitura no painel
e, numa segunda fase, o motoboy ao vivo.

## Goals

- Geocodificar o endereço do pedido no checkout e gravar `lat`/`lng` no
  `orders.address` (jsonb) — **zero migration de schema no pedido**.
- Deixar o cliente confirmar/corrigir o ponto com um pino arrastável.
- Mapa no painel de entregas mostrando os pedidos em rota.
- Custo zero de operação (free tier, sem cartão).

## Non-goals

- Rotas por via (OSRM/ORS) — a linha reta entre paradas basta por ora.
- Satélite / tiles pagos (MapTiler/Stadia).
- Otimização de sequência de paradas (TSP).
- App nativo (Expo). O motoboy usa PWA (Fase 2).
- PostGIS.

## Anti-goals

- Trocar o Nominatim por outro geocoder **sem cache** — estouraria a cota.
- Geocodificar no cliente (exporia a chave).
- Quebrar o RPC `create_order` (a validação de negócio vive lá).

## Constraints

- Stack atual: Next.js 15 (App Router), Supabase (Postgres + Realtime já
  publicado em `orders`), Vercel, Tailwind v4, vitest.
- Geocoder: **LocationIQ** (5.000 req/dia, sem cartão, uso comercial com link de
  volta). CEP: **BrasilAPI v2**.
- A chave do LocationIQ é **server-side** (`LOCATIONIQ_KEY`, sem `NEXT_PUBLIC_`).
- Migrations sequenciais, sem migrations de correção. A próxima é `020`.
- Padrões do repo: API routes em `app/api/*/route.ts` com `apiError`; clientes
  Supabase em `lib/supabase/{server,admin,client}.ts`; componentes em kebab-case.

## Decisões (minhas, o dono pode revisar)

- **Cache em tabela `geocode_cache`** (chave = endereço normalizado). Cada
  endereço novo = 1 chamada; repetido = 0. É o que mantém o free tier.
- **Cascata**: BrasilAPI CEP v2 (confirma o endereço; usa a coordenada quando
  vem) → LocationIQ (forward, coordenada comercial) → pino arrastável do cliente
  (garantia humana). A coordenada do CEP v2 vem do OSM, por isso o LocationIQ é o
  passo que dá precisão de verdade.
- **`geocodeAddress` server-side**; o checkout chama `POST /api/geo/geocode`.
- **Coordenada no `orders.address`** como `lat`/`lng` — o RPC só faz
  `jsonb_set(..., '{neighborhood_name}', ...)`, então chaves extras passam.
- **Mapa**: Leaflet (MIT) + tiles OSM. Sem chave, sem conta.

## O que fica para o builder

- Escolha fina dos campos enviados ao LocationIQ (structured vs `q` livre).
- Estilo dos pinos e copy dos avisos no checkout.
- Se a coordenada é obrigatória para entrega ou apenas avisada.

## Fase 2 (fora deste plano)

PWA do motoboy em `/motoboy` (login Supabase, lista de rotas, GPS via
`navigator.geolocation.watchPosition`), tabela `courier_positions` publicada no
Realtime, mapa ao vivo reusando o padrão de `lib/painel-live.ts`. Plano próprio.
