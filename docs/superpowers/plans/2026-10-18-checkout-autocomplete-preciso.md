# Autocomplete de rua preciso no checkout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando o cliente digita a rua no checkout, um dropdown mostra sugestões com coordenadas reais (LocationIQ autocomplete) — **não** o centroide genérico do CEP. Selecionar uma sugestão cai o pino exatamente na rua; o cliente só corrige o número/local fino.

**Architecture:** A API `/api/geo/autocomplete` já existe e devolve sugestões via LocationIQ, que inclui `lat`/`lon` por resultado — mas `parseAutocomplete` joga fora as coords. Plano: (1) preservar `lat`/`lng` na sugestão; (2) montar o dropdown no checkout com debounce e seleção; (3) ao selecionar, setar `endereco` + `coords` (origem precisa, sem aviso de "CEP aproximado").

**Tech Stack:** Next.js 15 (TS), LocationIQ, Supabase (cache `geocode_cache`), `storefront.css` + tokens.

**Spec:** `docs/superpowers/specs/2026-10-18-busca-endereco-notas.md`

## Decisão de escopo (ViaCEP vs LocationIQ)
ViaCEP **não devolve coordenadas** e sua busca por rua exige **UF + cidade**, que o checkout não possui (`SfMenuData.business` = `{id, nome, slug, logo_url, aberto_fechado}`; `neighborhoods` = `{id, name, fee_cents}`). O pino preciso só via centroide da BrasilAPI — **exatamente o "genérico" que queremos tirar** (Manaus: ~5km, bairro errado) — ou LocationIQ. LocationIQ já é a escolha integrada e devolve `lat`/`lon` na autocomplete → caminho escolhido. (Se o argumento por ViaCEP for só evitar quota do LocationIQ, ver Task 4 notas de custo.)

## Global Constraints
- `geocode.ts` é importado por client components → `createAdminClient` continua apenas via import dinâmico dentro de `geocodeAddress` (já assinado).
- `/api/geo/geocode` já loga rate-limit (60 req/h/IP). A autocomplete é GET + debounce 300ms + mínimo 3 chars no cliente.
- `geoOrigem` (state morto em checkout.tsx:53) **deve ser removido** — fonte do erro lint `no-unused-vars`; o sinal de aviso continua por `geoAviso`.
- CSS: `app/[slug]/storefront.css`, variáveis `.sf` + tokens `--color-accent`/`--color-border`.

## Review Focus
1. LocationIQ vazio/falha → dropdown vazio ou sumido, input mantido (não trava).
2. Resultado sem lat/lon válido → não seta coordenada.
3. < 3 chars → nenhuma chamada HTTP.
4. Selecionar sugestão → `coords` setado, `geoAviso` limpo (não fica aviso de "CEP aproximado").
5. Click fora / Escape → dropdown fecha.

---

### Task 1: `parseAutocomplete` preserva lat/lng
**Files:** Modify `lib/geocode.ts` · Test `lib/geocode.test.ts`
**Consumes:** LocationIQ autocomplete json `[{lat, lon, display_address, address:{road,house_number,suburb,postcode,city}}]`
**Produces:** `AddressSuggestion.lat?: number; lng?: number`

- [ ] **Step 1 — failing test.** Em `lib/geocode.test.ts`, fixture com `lat`/`lon` → `parseAutocomplete` retorna `lat`/`lng` numéricos; item sem `lat`/`lon` → `undefined`.
- [ ] **Step 2 — run (failing).** `npx vitest run lib/geocode.test.ts` → FAIL (campo inexistente).
- [ ] **Step 3 — implement.** Add `lat?: number; lng?: number` a `AddressSuggestion`; em `parseAutocomplete`, `parseFloat(d.lat)`/`parseFloat(d.lon)` filtrados por `posicaoValida`.
- [ ] **Step 4 — run (passing).** `npx vitest run lib/geocode.test.ts` → PASS.

### Task 2: dropdown as-you-type no checkout
**Files:** Modify `app/[slug]/checkout.tsx`
**Consumes:** `/api/geo/autocomplete?q=...&hood=...` → `{suggestions: AddressSuggestion[]}`; `AddressSuggestion.{label,lat,lng}`
**Produces:** `coords` preciso + `endereco` preenchido ao selecionar; remove `geoOrigem`.

- [ ] **Step 1 — remove dead state.** Tirar `geoOrigem`/`setGeoOrigem` (4 ocorrências: decl, `usarLocalizacao`, `aplicarPino`, `buscarEndereco`, `onChange` do mapa).
- [ ] **Step 2 — estado + debounce.** `suggestions` + `sugestoesAbertas`; onChange do input: 300ms, ≥3 chars, só delivery → fetch `/api/geo/autocomplete?q=${endereco}&hood=${hood}`.
- [ ] **Step 3 — dropdown.** Lista abaixo do input; `onKeyDown` ArrowUp/Down/Enter + click → seleciona.
- [ ] **Step 4 — seleção.** `setEndereco(s.label)` + `setCoords({lat:s.lat,lng:s.lng})` + limpa `geoAviso` + `setCep(s.cep)` (prefill) + fecha dropdown.
- [ ] **Step 5 — fechar.** Click fora / Escape → `setSugestoesAbertas(false)`.

### Task 3: estilos do dropdown
**Files:** Modify `app/[slug]/storefront.css`
- [ ] `.sf .endereco-sugestoes` (z-index 100, max-height 200px, overflow-y auto, border `--color-border`, bg card).
- [ ] `.sf .endereco-sugestao` hover/focus (bg hover, cursor pointer).

### Task 4: verificação
- [ ] `npx tsc --noEmit` → clean
- [ ] `npx eslint lib/geocode.ts lib/geocode.test.ts app/[slug]/checkout.tsx app/api/geo/autocomplete/route.ts` → 0 erros
- [ ] `npx vitest run lib/geocode.test.ts` → all pass
- [ ] Nota de custo: LocationIQ free tier 5k/mês. Com debounce 300ms + mín 3 chars + `countrycodes=br`, 1 usuário típico gasta ~2-5 req por endereço. Se preocupado com quota, migrar para BrasilAPI + Nominatim (sem chave) é viável — mas Nominatim reverse não tem endpoint de autocomplete e precisaria de outro front.
