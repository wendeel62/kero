# Mapa de entregas — endereço preciso + mapa ao vivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Escopo:** duas fases executáveis em sequência. **Fase 1** (Tasks 1-6): endereço preciso + mapa no painel. **Fase 2** (Tasks 7-12): PWA do motoboy + posição ao vivo. A Fase 2 depende da Fase 1.

**Goal:** Geocodificar o endereço do pedido (LocationIQ + BrasilAPI) e gravar `lat`/`lng` no `orders.address`, com pino arrastável no checkout e um mapa de leitura no painel; depois, o motoboy envia o GPS pelo PWA e o painel mostra o 🛵 ao vivo.

**Architecture:** A geocodificação roda server-side numa API route (`/api/geo/geocode`) que esconde a chave, valida a coordenada e usa um cache (`geocode_cache`) com rate limit por IP (`geocode_log`). O checkout guarda a coordenada no `address` (jsonb, sem migration de schema). Leaflet (tiles OSM) desenha o pino arrastável no checkout e os pontos das entregas no painel, sempre com `dynamic(..., { ssr: false })`.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres), Tailwind v4, Leaflet 1.9, vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-mapa-entregas-locationiq-design.md`

## Global Constraints

- Chave do geocoder server-side: `LOCATIONIQ_KEY` (nunca `NEXT_PUBLIC_`).
- Migrations sequenciais; a próxima é `020`. Sem migrations de correção.
- Geocoder primário: LocationIQ `https://us1.locationiq.com/v1/search` (free: 5.000 req/dia, sem cartão). CEP: BrasilAPI `https://brasilapi.com.br/api/cep/v2/{cep}`.
- **Toda coordenada é validada no servidor** por `posicaoValida` (range + finito) — na saída do geocoder, no `mapPoints` e no `/api/orders`.
- **Rate limit por IP** no `/api/geo/geocode` (protege a cota do LocationIQ), reusando `calculate_ip_hash`.
- Coordenada vive em `orders.address.lat` / `orders.address.lng` (jsonb). Não alterar o RPC `create_order`.
- **Componentes Leaflet são client-only e carregados com `dynamic(..., { ssr: false })`** (o `import "leaflet"` quebra no SSR).
- Componentes em kebab-case (`components/*.tsx`); libs puras em `lib/*.ts` com teste `lib/*.test.ts`.
- API routes usam `apiError(code, message, status)` de `@/lib/api-errors`.
- Tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` com atribuição.

## Review Focus

- **CEP sem coordenada na BrasilAPI e LocationIQ fora do ar** → `geocodeExternal` devolve `null`; o checkout não pode travar nem enviar pedido sem ponto. O mapa abre no centro padrão e o cliente arrasta.
- **Coordenada inválida (NaN, fora do range)** → rejeitada no servidor em três pontos: saída do geocoder, `mapPoints` do painel e payload do `/api/orders`.
- **Cache envenenado por endereço mal digitado** → `query_key` é o endereço normalizado; endereços diferentes não colidem.
- **Cota do LocationIQ** → cache (inclui falhas) + rate limit por IP antes de qualquer chamada externa.
- **Pino arrastável sem mapa renderizado (SSR)** → o componente é carregado com `ssr: false` e não roda no servidor.

---

### Task 1: Migration `020_geocode_cache`

**Files:**
- Create: `supabase/migrations/020_geocode_cache.sql`

**Interfaces:**
- Produces: tabela `geocode_cache(query_key text unique, lat float8 null, lng float8 null, endereco text, falha boolean, expira_em timestamptz, criado_em)`; tabela `geocode_log(ip_hash text, criado_em)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- 020_geocode_cache.sql — cache de geocodificação + log de rate limit.
-- Só service_role acessa (RLS on, sem policy). lat/lng null quando falha=true.
create table if not exists geocode_cache (
  id uuid primary key default gen_random_uuid(),
  query_key text not null unique,
  lat float8,
  lng float8,
  endereco text,
  falha boolean not null default false,
  expira_em timestamptz,          -- TTL curto p/ cachear falhas
  criado_em timestamptz not null default now()
);
alter table geocode_cache enable row level security;

create table if not exists geocode_log (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  criado_em timestamptz not null default now()
);
alter table geocode_log enable row level security;
create index if not exists idx_geocode_log_ip on geocode_log(ip_hash, criado_em desc);
```

- [ ] **Step 2: Aplicar a migration**

Rodar via `mcp__supabase__apply_migration` (name `020_geocode_cache`).
Expected: aplica sem erro.

- [ ] **Step 3: Verificar a tabela e a constraint**

```sql
insert into geocode_cache (query_key, lat, lng) values ('probe', -3.1, -60.0);
insert into geocode_cache (query_key, lat, lng) values ('probe', -3.2, -60.1); -- deve falhar
```
Expected: o 2º insert falha com violação de unique; depois `delete from geocode_cache where query_key = 'probe';`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_geocode_cache.sql
git commit -m "feat: migration geocode_cache + rate limit log"
```

---

### Task 2: `lib/geocode.ts` (normalização, validação, cascata)

**Files:**
- Create: `lib/geocode.ts`
- Test: `lib/geocode.test.ts`

**Interfaces:**
- Produces:
  - `type GeocodeInput = { cep?: string; street?: string; number?: string; complement?: string; neighborhood?: string; city?: string }`
  - `type Coords = { lat: number; lng: number }`
  - `posicaoValida(lat: number, lng: number): boolean`
  - `normalizeAddress(input: GeocodeInput): string`
  - `geocodeExternal(input: GeocodeInput, fetchImpl?: typeof fetch): Promise<Coords | null>`
  - `geocodeAddress(input: GeocodeInput): Promise<Coords | null>` (cache com TTL de falha + `geocodeExternal`; consome `createAdminClient`)

- [ ] **Step 1: Escrever os testes**

```ts
import { test, expect } from "vitest";
import { normalizeAddress, geocodeExternal, posicaoValida } from "./geocode";

test("posicaoValida: range e finito", () => {
  expect(posicaoValida(-3.1, -60)).toBe(true);
  expect(posicaoValida(NaN, -60)).toBe(false);
  expect(posicaoValida(200, -60)).toBe(false);
  expect(posicaoValida(-3, 999)).toBe(false);
});

test("normalizeAddress: canônico, ignora vazio e caixa", () => {
  expect(normalizeAddress({ cep: "69000000", street: "Rua A", number: "10" })).toBe("69000000|rua a|10");
});

test("geocodeExternal: LocationIQ responde → usa a coordenada dele (com cidade na query)", async () => {
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(String(url));
    if (String(url).includes("brasilapi")) return { ok: true, json: async () => ({ logradouro: "Rua A", localidade: "Manaus", uf: "AM" }) };
    return { ok: true, json: async () => [{ lat: "-3.10", lon: "-60.00" }] };
  }) as unknown as typeof fetch;
  const r = await geocodeExternal({ street: "Rua A", number: "10", cep: "69000000" }, fake);
  expect(r).toEqual({ lat: -3.1, lng: -60.0 });
  expect(urls.some((u) => u.includes("locationiq") && u.includes("Manaus"))).toBe(true);
});

test("geocodeExternal: LocationIQ falha → cai no CEP da BrasilAPI", async () => {
  const fake = (async (url: string) => {
    if (String(url).includes("locationiq")) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ localidade: "Manaus", uf: "AM", location: { coordinates: { latitude: -3.2, longitude: -60.2 } } }) };
  }) as unknown as typeof fetch;
  const r = await geocodeExternal({ street: "Rua A", number: "10", cep: "69000000" }, fake);
  expect(r).toEqual({ lat: -3.2, lng: -60.2 });
});

test("geocodeExternal: tudo falha → null", async () => {
  const fake = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
  expect(await geocodeExternal({ street: "Rua A", cep: "69000000" }, fake)).toBeNull();
});
```

- [ ] **Step 2: Rodar os testes (falham)** — `npx vitest run lib/geocode.test.ts` → FAIL.

- [ ] **Step 3: Implementar `lib/geocode.ts`**

`posicaoValida` = `Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180`.
`normalizeAddress` = campos não-vazios, `trim().toLowerCase()`, juntados por `|` (cep, street, number, neighborhood, city).
`geocodeExternal(input, fetchImpl = fetch)`:
1. Se CEP (8 díg): `GET https://brasilapi.com.br/api/cep/v2/{cep}` → guarda `logradouro`, `localidade` (cidade), `uf` e `location.coordinates` (fallback).
2. Se `LOCATIONIQ_KEY` e há endereço: `GET https://us1.locationiq.com/v1/search?key={key}&q={street number, neighborhood, city-uf, cep, Brasil}&format=json&limit=1&countrycodes=br` → `[{lat, lon}]`; retorna se `posicaoValida`.
3. Se o LocationIQ falhou e a BrasilAPI trouxe `location.coordinates`: usa essas.
4. Senão `null`.

`geocodeAddress(input)`: `query_key = normalizeAddress(input)`; lê `geocode_cache` (admin client); se a linha existe e **não expirou**: `falha` → `null`, senão `{lat,lng}`. Se não existe/expirada: `geocodeExternal`; sucesso → upsert `(lat,lng,falha=false,expira_em=null)`; falha → upsert `(lat=null,lng=null,falha=true,expira_em=now+1h)`; retorna o resultado.

- [ ] **Step 4: Rodar os testes (passam)** — `npx vitest run lib/geocode.test.ts` → PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/geocode.ts lib/geocode.test.ts
git commit -m "feat: geocodificação com validação, cidade e cache de falhas"
```

---

### Task 3: API route `/api/geo/geocode` (rate limit + validação)

**Files:**
- Create: `app/api/geo/geocode/route.ts`

**Interfaces:**
- Consumes: `geocodeAddress`, `posicaoValida` (Task 2); `calculate_ip_hash` (RPC existente); `geocode_log` (Task 1).
- Produces: `POST /api/geo/geocode` → `200 { lat, lng }` | `404 GEOCODE_FAILED` | `429 RATE_LIMIT` | `400 INVALID_BODY`.

- [ ] **Step 1: Implementar a route**

`POST`: lê o IP de `x-forwarded-for`; `const ip_hash = (await admin.rpc("calculate_ip_hash", { p_ip: ip })).data`; conta `geocode_log` do `ip_hash` na última hora (via admin client) — `>= 60` → `apiError("RATE_LIMIT", "Muitas buscas de endereço. Aguarde um pouco.", 429)`; insere a linha em `geocode_log`. Depois: valida `street`/`cep` string (`INVALID_BODY` 400), monta `GeocodeInput`, chama `geocodeAddress`; resultado `null` ou `!posicaoValida(lat,lng)` → `apiError("GEOCODE_FAILED", "Não encontramos o ponto no mapa.", 404)`; senão `NextResponse.json({ lat, lng })`. Seguir o shape de `app/api/orders/route.ts`.

- [ ] **Step 2: Verificar manualmente (cache + rate limit)**

Com `npm run dev`, chamar o mesmo endereço duas vezes:
`curl -s -X POST localhost:3000/api/geo/geocode -H 'content-type: application/json' -d '{"cep":"69000000","street":"Av. Eduardo Ribeiro","number":"520"}'`
Expected: `{"lat":...,"lng":...}` (ou 404). Conferir o cache (1 linha após a 1ª, ainda 1 após a 2ª) e o log:
```sql
select query_key, lat, lng, falha from geocode_cache;
select count(*) from geocode_log;
```

- [ ] **Step 3: Commit**

```bash
git add app/api/geo/geocode/route.ts
git commit -m "feat: endpoint /api/geo/geocode com rate limit"
```

---

### Task 4: Componente `checkout-map` (pino arrastável)

**Files:**
- Create: `components/checkout-map.tsx`
- Modify: `package.json` (adiciona `leaflet`, `@types/leaflet`)

**Interfaces:**
- Produces: `export default function CheckoutMap({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void })` — **carregado pelo consumidor com `dynamic(..., { ssr: false })`**.

- [ ] **Step 1: Instalar o Leaflet**

```bash
npm i leaflet && npm i -D @types/leaflet
```

- [ ] **Step 2: Implementar o componente**

`"use client"`. `<div ref>` `height: 260px`, `border-radius`. No `useEffect([])`: `L.map` no centro `[lat, lng]` zoom 16, `L.tileLayer(...)` OSM, `L.marker([lat, lng], { draggable: true, icon: pinIcon })`, `marker.on("dragend", () => onChange(...))`. **Não usar o ícone padrão do Leaflet** (quebra com bundler): definir `const pinIcon = L.divIcon({ className: "", html: "📍", iconSize: [28, 28], iconAnchor: [14, 28] })`. Cleanup `map.remove()`. Segundo `useEffect([lat, lng])`: `marker.setLatLng` + `map.panTo`. Importar `"leaflet/dist/leaflet.css"`. Base: `apps/admin/src/components/CheckoutMap.tsx` do cardapio-digital.

- [ ] **Step 3: Verificar o build** — `npm run build` → PASS.

- [ ] **Step 4: Commit**

```bash
git add components/checkout-map.tsx package.json package-lock.json
git commit -m "feat: componente de mapa do checkout com pino arrastável"
```

---

### Task 5: Integrar geocodificação + pino no checkout

**Files:**
- Modify: `app/[slug]/checkout/checkout-client.tsx`
- Modify: `app/api/orders/route.ts` (validação de coordenada)

**Interfaces:**
- Consumes: `CheckoutMap` (Task 4), `POST /api/geo/geocode` (Task 3), `posicaoValida` (Task 2).
- Produces: `address` do payload passa a incluir `lat`/`lng` validados.

- [ ] **Step 1: Estado + geocodificação com debounce**

`const [coords, setCoords] = useState<{lat:number;lng:number}|null>(null)` e `const [pinoConfirmado, setPinoConfirmado] = useState(false)`. Um `useEffect` em `[cep, street, number]` com **debounce de 700 ms** (`setTimeout` + `clearTimeout` no cleanup): se CEP tem 8 dígitos, rua não vazia **e `!pinoConfirmado`**, faz `fetch("/api/geo/geocode", ...)` com `{cep, street, number, neighborhood: hood?.name}`; em `200`, `setCoords(await res.json())`. Não dispara se o cliente já arrastou o pino (evita sobrescrever a escolha dele).

- [ ] **Step 2: Renderizar o mapa (client-only)**

Dentro do bloco `fulfillment === "delivery"`: `const CheckoutMap = dynamic(() => import("@/components/checkout-map"), { ssr: false, loading: () => <div style={{height:260}} /> })` (declarar no topo do arquivo) e renderizar `<CheckoutMap lat={coords?.lat ?? -3.10} lng={coords?.lng ?? -60.00} onChange={(la, ln) => { setCoords({lat:la,lng:ln}); setPinoConfirmado(true); }} />` com a legenda "Confirme o ponto no mapa — arraste o pino se precisar."

- [ ] **Step 3: Enviar a coordenada**

Em `buildPayload`, no `address` de delivery: `lat: coords?.lat ?? null, lng: coords?.lng ?? null`.

- [ ] **Step 4: Validação no cliente**

Em `submit`, em `fulfillment === "delivery"`: `if (!coords) errs.push("Confirme o ponto de entrega no mapa.");`.

- [ ] **Step 5: Validação no servidor**

Em `app/api/orders/route.ts`, antes do RPC: se `b.address` tem `lat`/`lng`, e `!posicaoValida(Number(lat), Number(lng))`, apaga as duas chaves do `address` (não rejeita o pedido — o endereço textual continua válido).

- [ ] **Step 6: Verificar no navegador**

Com `npm run dev`: abrir `/{slug}/checkout`, escolher entrega, digitar CEP + rua + número → o pino aparece (uma vez, não a cada tecla); arrastar → mover; digitar mais no número → o pino **não** volta. Enviar e conferir:
```sql
select address->>'lat', address->>'lng' from orders order by created_at desc limit 1;
```

- [ ] **Step 7: Rodar a suíte** — `npx vitest run tests/orders-api.test.ts` → PASS.

- [ ] **Step 8: Commit**

```bash
git add app/[slug]/checkout/checkout-client.tsx app/api/orders/route.ts
git commit -m "feat: geocodifica endereço e confirma ponto no checkout"
```

---

### Task 6: Mapa no painel de entregas

**Files:**
- Modify: `lib/deliveries.ts` (`mapPoints`)
- Modify: `lib/deliveries.test.ts`
- Create: `components/delivery-map.tsx`
- Modify: `lib/painel.ts` (`getEntregas` inclui `address` e devolve `mapPoints`)
- Modify: `app/painel/entregas/page.tsx`

**Interfaces:**
- Consumes: `posicaoValida` (Task 2).
- Produces:
  - `type MapPoint = { id: string; code: string; lat: number; lng: number; status: string }`
  - `mapPoints(orders: { id: string; code: string; status: string; address: unknown }[]): MapPoint[]`
  - `export default function DeliveryMap({ points, couriers }: { points: MapPoint[]; couriers?: CourierPin[] })`

- [ ] **Step 1: Teste de `mapPoints`**

```ts
import { mapPoints } from "./deliveries";

test("mapPoints: extrai coords válidas e ignora as inválidas", () => {
  const pts = mapPoints([
    { id: "a", code: "1", status: "out", address: { lat: -3.1, lng: -60.0 } },
    { id: "b", code: "2", status: "out", address: { street: "X" } },
    { id: "c", code: "3", status: "out", address: { lat: 999, lng: -60 } },
    { id: "d", code: "4", status: "out", address: null },
  ]);
  expect(pts).toEqual([{ id: "a", code: "1", status: "out", lat: -3.1, lng: -60.0 }]);
});
```

- [ ] **Step 2: Rodar (falha)** — `npx vitest run lib/deliveries.test.ts` → FAIL.

- [ ] **Step 3: Implementar `mapPoints`** — filtra ordens cujo `address` tem `lat`/`lng` que passam em `posicaoValida`; devolve `MapPoint[]`.

- [ ] **Step 4: Implementar `components/delivery-map.tsx`**

`"use client"`, Leaflet vanilla em refs (padrão de `apps/admin/src/components/DeliveryMap.tsx` do cardapio-digital): inicializa uma vez, tiles OSM, e em `useEffect([points, couriers])` redesenha os marcadores (`L.divIcon` com o `code`) e faz `fitBounds`. Limpa a camada anterior a cada render. (Consumidor carrega com `dynamic(..., { ssr: false })`.)

- [ ] **Step 5: `getEntregas` inclui `address` e expõe os pontos**

Em `lib/painel.ts`, no select de `orders`, acrescentar `,address`; `mapPoints` a partir dos pedidos `status === "out"`; devolver como `mapPoints`. Ajustar `EntregasData` em `app/painel/entregas/page.tsx`.

- [ ] **Step 6: Renderizar no painel**

Em `app/painel/entregas/page.tsx`, acima do board: `{data.mapPoints.length > 0 && <DeliveryMap points={data.mapPoints} />}`, com `const DeliveryMap = dynamic(() => import("@/components/delivery-map"), { ssr: false })`.

- [ ] **Step 7: Verificar no navegador** — atribuir um pedido com coordenada e abrir `/painel/entregas`; o pino aparece.

- [ ] **Step 8: Rodar a suíte completa** — `npm run test` → PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/deliveries.ts lib/deliveries.test.ts lib/painel.ts components/delivery-map.tsx app/painel/entregas/page.tsx
git commit -m "feat: mapa das entregas em rota no painel"
```

---

## Fase 2: PWA do motoboy + posição ao vivo

**Goal:** o motoboy loga no PWA `/motoboy`, vê sua rota e envia o GPS; o painel mostra o 🛵 se movendo no mapa em tempo real.

**Architecture:** o motoboy é um usuário Supabase Auth vinculado a `couriers.user_id`. A posição vive em `courier_positions`, publicada no Realtime; o painel assina via `postgres_changes` (mesmo padrão de `lib/painel-live.ts`). O envio de GPS é do próprio cliente (RLS garante que o motoboy só escreve a própria linha) — sem API route nova.

**Pré-requisito:** Fase 1 concluída.

**Decisões (minhas, o dono pode revisar):**
- Motoboy **não** marca entrega como entregue — quem muda status continua sendo o lojista (`set_order_status`). Corta escopo.
- Login por **e-mail + senha** (padrão do `/login`), usuário criado pelo lojista via Auth Admin API. Sem magic link (o kero não tem SMTP).
- `courier_positions` guarda `store_id` denormalizado — permite o filtro do Realtime por loja **e** é validado no `with check` (não confia no cliente).
- **Encerramento de rota entra no escopo** (Task 12): hoje o kero cria rotas `open` que nunca fecham — o motoboy fica travado (`COURIER_EM_ROTA`) e o rastreamento nunca pararia (LGPD).

### Review Focus (Fase 2)

- **Motoboy sem rota `open`** → o PWA não envia GPS (nem aparece no painel).
- **Gravar `store_id` de outra loja** → barrado no `with check` da policy (deriva do courier, não do cliente).
- **Geolocalização negada ou tela bloqueada** → badge de aviso + Screen Wake Lock; sem escrita em `courier_positions`.
- **Motoboy parado (sem atualizar)** → o painel esmaece/oculta quem não atualiza há alguns minutos.
- **Realtime cai no painel** → mantém as últimas posições; não zera o mapa.

### Task 7: Migration `021_motoboy_live`

**Files:**
- Create: `supabase/migrations/021_motoboy_live.sql`

**Interfaces:**
- Produces: `couriers.user_id`; `courier_positions(courier_id pk, store_id, lat, lng, precisao, atualizado_em)`; `auth_courier_id()` e `auth_courier_store_id()`; policies do motoboy e de posição; `courier_positions` na publicação.

- [ ] **Step 1: Escrever a migration**

```sql
-- 021_motoboy_live.sql — motoboy vinculado a usuário + posição ao vivo.
alter table couriers add column if not exists user_id uuid unique references auth.users on delete set null;

create table if not exists courier_positions (
  courier_id uuid primary key references couriers on delete cascade,
  store_id uuid not null references stores on delete cascade,
  lat float8 not null,
  lng float8 not null,
  precisao float8,
  atualizado_em timestamptz not null default now()
);

create or replace function auth_courier_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from couriers where user_id = auth.uid()
$$;

-- store_id do próprio motoboy: usado no with check p/ impedir forjar outra loja
create or replace function auth_courier_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from couriers where user_id = auth.uid()
$$;

revoke execute on function auth_courier_id() from public, anon;
revoke execute on function auth_courier_store_id() from public, anon;
grant execute on function auth_courier_id() to authenticated;
grant execute on function auth_courier_store_id() to authenticated;

alter table courier_positions enable row level security;

-- motoboy: lê a própria linha de couriers
drop policy if exists "courier_self_select" on couriers;
create policy "courier_self_select" on couriers
  for select to authenticated using (user_id = auth.uid());

-- motoboy: lê as próprias rotas ABERTAS e paradas
drop policy if exists "courier_routes_select" on routes;
create policy "courier_routes_select" on routes
  for select to authenticated using (courier_id = auth_courier_id() and status = 'open');

drop policy if exists "courier_stops_select" on route_stops;
create policy "courier_stops_select" on route_stops
  for select to authenticated
  using (exists (select 1 from routes r where r.id = route_stops.route_id and r.courier_id = auth_courier_id() and r.status = 'open'));

-- motoboy: lê só os pedidos das rotas ABERTAS
drop policy if exists "courier_orders_select" on orders;
create policy "courier_orders_select" on orders
  for select to authenticated
  using (exists (
    select 1 from route_stops rs
    join routes r on r.id = rs.route_id
    where rs.order_id = orders.id and r.courier_id = auth_courier_id() and r.status = 'open'
  ));

-- motoboy: escreve/lê a própria posição; store_id derivado do courier (nunca do cliente)
drop policy if exists "courier_pos_self" on courier_positions;
create policy "courier_pos_self" on courier_positions
  for all to authenticated
  using (courier_id = auth_courier_id())
  with check (courier_id = auth_courier_id() and store_id = auth_courier_store_id());

-- lojista: lê as posições da própria loja
drop policy if exists "lojista_pos_select" on courier_positions;
create policy "lojista_pos_select" on courier_positions
  for select to authenticated using (store_id = auth_store_id());

create index if not exists idx_courier_positions_store on courier_positions(store_id);

alter publication supabase_realtime add table courier_positions;
```

- [ ] **Step 2: Aplicar** via `mcp__supabase__apply_migration` (name `021_motoboy_live`).

- [ ] **Step 3: Verificar publication, funções e o guard do store_id**

```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'courier_positions';
select proname from pg_proc where proname in ('auth_courier_id','auth_courier_store_id');
```
Expected: uma linha e duas linhas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/021_motoboy_live.sql
git commit -m "feat: vínculo do motoboy e posição ao vivo"
```

---

### Task 8: `requireCourier` + `lib/couriers.ts`

**Files:**
- Create: `lib/couriers.ts`
- Test: `lib/couriers.test.ts`
- Modify: `lib/auth.ts`

**Interfaces:**
- Produces:
  - `posicaoRecente(atualizadoEm: string, agoraMs?: number, limiteMin?: number): boolean` (puro; default limite 3 min)
  - `requireCourier(): Promise<{ supabase; userId: string; courierId: string; storeId: string }>`

- [ ] **Step 1: Teste de `posicaoRecente`**

```ts
import { test, expect } from "vitest";
import { posicaoRecente } from "./couriers";

test("posicaoRecente: recente = true, antiga = false", () => {
  const agora = Date.parse("2026-10-12T12:00:00Z");
  expect(posicaoRecente("2026-10-12T11:59:00Z", agora)).toBe(true);
  expect(posicaoRecente("2026-10-12T11:50:00Z", agora)).toBe(false);
});
```

- [ ] **Step 2: Rodar (falha)** — `npx vitest run lib/couriers.test.ts` → FAIL.

- [ ] **Step 3: Implementar `posicaoRecente`** — `agoraMs - Date.parse(atualizadoEm) <= limiteMin * 60_000`.

- [ ] **Step 4: Implementar `requireCourier` em `lib/auth.ts`**

```ts
export async function requireCourier() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/motoboy/login");
  const { data: courier } = await supabase
    .from("couriers").select("id, store_id").eq("user_id", user.id).single();
  if (!courier) redirect("/motoboy/login");
  return { supabase, userId: user.id, courierId: courier.id, storeId: courier.store_id };
}
```

- [ ] **Step 5: Rodar (passa)** — `npx vitest run lib/couriers.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/couriers.ts lib/couriers.test.ts lib/auth.ts
git commit -m "feat: guard e helpers do motoboy"
```

---

### Task 9: Cadastro de motoboy no painel

**Files:**
- Modify: `lib/painel-actions.ts` (action `criarMotoboy`)
- Modify: `lib/painel.ts` (`getEntregas` lista couriers com `user_id`)
- Modify: `lib/deliveries.ts` (tipo `Courier` ganha `vinculado`)
- Modify: `app/painel/entregas/page.tsx` (botão + modal "Novo motoboy")

**Interfaces:**
- Produces: `criarMotoboy(input: { name: string; phone: string; email: string; password: string }): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Implementar a action (com rollback do usuário órfão)**

Em `lib/painel-actions.ts`: valida `name`/`email`/`password` (senha ≥ 8); `const admin = createAdminClient()`; `const { data: created, error: uerr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })`; erro `EMAIL_EXISTS` → mensagem PT. Depois `const { error } = await supabase.from("couriers").insert({ store_id: storeId, name, phone, user_id: created.user.id })`; **se o insert falhar, `await admin.auth.admin.deleteUser(created.user.id)`** e devolver o erro (não deixar usuário órfão). `revalidatePath("/painel/entregas")`.

- [ ] **Step 2: Listar couriers com vínculo**

Em `lib/painel.ts` (`getEntregas`), incluir `user_id` no select de `couriers`; expor `vinculado: boolean` no tipo `Courier` (`lib/deliveries.ts`).

- [ ] **Step 3: UI**

Em `app/painel/entregas/page.tsx`, botão "Novo motoboy" → modal (padrão do modal de assign) com nome, telefone, e-mail e senha; chama `criarMotoboy`; sucesso → `load()`. Mostrar "sem acesso" ao lado de courier sem `user_id`.

- [ ] **Step 4: Verificar**

Criar um motoboy pelo painel; conferir:
```sql
select c.name, c.user_id is not null as vinculado from couriers c order by c.name;
```
Expected: `vinculado = true`. Depois logar em `/motoboy` com o e-mail/senha.

- [ ] **Step 5: Commit**

```bash
git add lib/painel-actions.ts lib/painel.ts lib/deliveries.ts app/painel/entregas/page.tsx
git commit -m "feat: cadastro de motoboy com acesso ao PWA"
```

---

### Task 10: PWA `/motoboy` (login + rota + GPS)

**Files:**
- Create: `app/motoboy/page.tsx`
- Create: `app/motoboy/motoboy-client.tsx`
- Create: `app/motoboy/login/page.tsx`
- Create: `app/motoboy/login/login-client.tsx`

**Interfaces:**
- Consumes: `requireCourier` (Task 8), `posicaoValida` (Task 2), `courier_positions` (Task 7).
- Produces: PWA que faz `upsert` em `courier_positions` a cada ~10 s enquanto há rota `open`, com Wake Lock.

- [ ] **Step 1: Login** — copiar o padrão de `app/login/login-client.tsx` (`signInWithPassword`); após entrar, consultar `couriers` por `user_id`; vinculado → `router.replace("/motoboy")`; senão `signOut()` + "Acesso não vinculado a um motoboy."

- [ ] **Step 2: Página do motoboy (server)** — `app/motoboy/page.tsx`: `const { supabase, courierId } = await requireCourier();` carrega a rota `open` + `route_stops` + `orders` do endereço (via RLS) e passa ao client.

- [ ] **Step 3: Client — rota + GPS + Wake Lock**

`app/motoboy/motoboy-client.tsx` (`"use client"`): lista a rota e as paradas (endereço + nº). Com rota `open`, botão "Iniciar rastreamento" + badge de GPS. Ao iniciar:
- **Screen Wake Lock**: `navigator.wakeLock?.request("screen")` e re-request no `visibilitychange` (o `watchPosition` para com a tela bloqueada); avisar o motoboy que a tela precisa ficar ativa.
- `navigator.geolocation.watchPosition` (`enableHighAccuracy: true`, `maximumAge: 5000`, `timeout: 15000`); a cada ~10 s (`Date.now()` guard) e se `posicaoValida(lat, lng)`: `supabase.from("courier_positions").upsert({ courier_id: courierId, store_id: storeId, lat, lng, precisao: pos.coords.accuracy, atualizado_em: new Date().toISOString() })` (o `store_id` é validado pelo `with check`).
- Cleanup: `clearWatch` + `wakeLock.release()`.
- Botão "Navegar" por parada: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` (fallback textual).

- [ ] **Step 4: Verificar no navegador** — logar em `/motoboy`, iniciar rastreamento; conferir `select courier_id, lat, lng, atualizado_em from courier_positions;` com `atualizado_em` renovando a cada ~10 s.

- [ ] **Step 5: Rodar a suíte** — `npm run test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add app/motoboy
git commit -m "feat: PWA do motoboy com envio de GPS"
```

---

### Task 11: Mapa ao vivo no painel

**Files:**
- Modify: `lib/painel-live.ts` (hook `useCouriersLive`)
- Modify: `lib/painel.ts` (`getEntregas` devolve as posições iniciais)
- Modify: `components/delivery-map.tsx` (desenha os 🛵 e esmaece os antigos)
- Modify: `app/painel/entregas/page.tsx`

**Interfaces:**
- Consumes: `courier_positions` no Realtime (Task 7); `posicaoRecente` (Task 8).
- Produces:
  - `useCouriersLive(storeId: string | null, onPosicao: (p: { courierId: string; lat: number; lng: number; atualizadoEm: string }) => void): void`
  - `DeliveryMap({ points, couriers }: { points: MapPoint[]; couriers?: CourierPin[] })` onde `CourierPin = { courierId: string; nome: string; lat: number; lng: number; atualizadoEm: string }`.

- [ ] **Step 1: Hook de live** — em `lib/painel-live.ts`, `useCouriersLive`: `createClient()`, `.channel("couriers:" + storeId).on("postgres_changes", { event: "*", schema: "public", table: "courier_positions", filter: "store_id=eq." + storeId }, (p) => onPosicao({ courierId: p.new.courier_id, lat: p.new.lat, lng: p.new.lng, atualizadoEm: p.new.atualizado_em })).subscribe()`; cleanup `removeChannel`.

- [ ] **Step 2: Posições iniciais** — em `getEntregas`, buscar `courier_positions` da loja (join `couriers.name`) e devolver como `courierPositions`; incluir no tipo `EntregasData`.

- [ ] **Step 3: Desenhar e esmaecer** — em `components/delivery-map.tsx`, aceitar `couriers?` e desenhar um `L.divIcon` 🛵 por courier (atualiza se já existe). Marcar com opacidade reduzida quem **não** passa em `posicaoRecente(atualizadoEm)` (motoboy parado).

- [ ] **Step 4: Ligar no painel** — estado `courierPositions` inicial pelo servidor; `useCouriersLive(storeId, (p) => setCourierPositions(atualiza(p)))`; passar `couriers={courierPositions}` ao `DeliveryMap`.

- [ ] **Step 5: Verificar de ponta a ponta** — duas abas: `/motoboy` enviando GPS e `/painel/entregas`; o 🛵 aparece e se move sem recarregar; parar o motoboy → o pino esmaece após ~3 min.

- [ ] **Step 6: Rodar a suíte completa** — `npm run test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/painel-live.ts lib/painel.ts components/delivery-map.tsx app/painel/entregas/page.tsx
git commit -m "feat: mapa ao vivo dos motoboys no painel"
```

---

### Task 12: Encerrar rota (fecha o fluxo do kero)

**Contexto:** hoje nenhuma ação muda `routes.status` para `closed` (só existe o `check` na migration 017). Sem isso, o motoboy fica preso em `COURIER_EM_ROTA` e o rastreamento nunca para.

**Files:**
- Modify: `lib/painel-actions.ts` (action `encerrarRota`)
- Modify: `app/painel/entregas/page.tsx` (botão "Encerrar rota" por motoboy em rota)
- Modify: `lib/painel.ts` (`getEntregas` expõe o `routeId` aberto por courier)

**Interfaces:**
- Produces: `encerrarRota(routeId: string): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Implementar a action**

Em `lib/painel-actions.ts`: `const { supabase, storeId } = await requireStore();` `supabase.from("routes").update({ status: "closed" }).eq("id", routeId).eq("store_id", storeId)`; depois `supabase.from("courier_positions").delete().eq("courier_id", <courier da rota>)` (LGPD — some do mapa ao encerrar). `revalidatePath("/painel/entregas")`.

- [ ] **Step 2: Expor o `routeId` aberto**

Em `lib/painel.ts` (`getEntregas`), a query de `routes` já lê as `open`; devolver um mapa `routeIdPorCourier: Record<string, string>`.

- [ ] **Step 3: UI**

Em `app/painel/entregas/page.tsx`, na coluna "Em rota", um botão "Encerrar rota" que chama `encerrarRota(data.routeIdPorCourier[o.courierId])` e recarrega.

- [ ] **Step 4: Verificar**

Encerrar uma rota pelo painel; conferir:
```sql
select status from routes where id = '<routeId>';           -- closed
select count(*) from courier_positions where courier_id = '<courierId>';  -- 0
```
E que o motoboy pode receber nova rota (`assign_courier` deixa de dar `COURIER_EM_ROTA`).

- [ ] **Step 5: Rodar a suíte completa** — `npm run test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/painel-actions.ts lib/painel.ts app/painel/entregas/page.tsx
git commit -m "feat: encerrar rota e limpar posição do motoboy"
```

---

## Verificações antes de confiar (não-código)

- **Testar 30-50 endereços reais da sua região** contra o LocationIQ antes de confiar na precisão. O LocationIQ se apoia em dados do OSM, então o ganho real vem do CEP (BrasilAPI) e do pino arrastável — não do provedor.
- **Confirmar nos termos do LocationIQ** que armazenar o resultado (cache) é permitido no plano free (o free exige um link de volta ao site).
- **Tiles do OSM**: a política deles limita uso pesado; antes de virar SaaS com várias lojas, trocar por MapTiler ou Stadia.

## Notas de custo e limites

- Geocodificação: LocationIQ 5.000 req/dia (free, sem cartão) + BrasilAPI (sem chave) + cache (inclui falhas) + rate limit por IP. Tiles: OSM (uso justo). Leaflet: MIT. Supabase Realtime: incluído no free tier. **Custo zero de operação no MVP.**
- Gargalo real futuro: cota do LocationIQ quando o número de lojas crescer — mitigado pelo cache (1 chamada por endereço novo, falhas por 1 h).
