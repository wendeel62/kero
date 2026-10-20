# Autocomplete as-you-time preciso no checkout — caminho correto

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`. Implemente task-by-task com verificação em cada passo. **NÃO commit.**

**Goal:** quando o cliente digita a rua no checkout, um dropdown as-you-time mostra sugestões de rua. Ao aceitar uma sugestão, o pino cai **exatamente na rua** via forward-geocode preciso — NÃO via coordenadas do autocomplete.

**Decisão (do usuário, 2026-10-18):** o autocomplete **fornece o nome da rua**; a precisão do pino vem do **forward-geocode** (`/api/geo/geocode`). O probe provou que o `lat/lon` do LocationIQ autocomplete é **1,67km de errado** em Manaus (devolve 69000-000) — portanto **rejeitado**. O plano anterior (`docs/superpowers/plans/2026-10-18-checkout-autocomplete-preciso.md`) que preservava `lat/lon` na sugestão está **arquivado/superseded** por este.

## Architecture (exists — reuse, no server changes)
- `app/api/geo/autocomplete/route.ts` — GET `?q=&hood=` → `{ suggestions: [{label, street, number, neighborhood, cep}] }`. **Nenhum lat/lon** no output (intencional, força o caminho preciso). Rota OK, não mexer.
- `app/api/geo/geocode/route.ts` — POST `{cep, street, number, neighborhood, city}` → `{lat, lng, origem}`. **Já corrigido** (raiz do bug) e testado (AC3: Manaus Rua Jerusalém → `{-3.0896424, -59.9790003, "enderecura"}`). Não mexer.
- `lib/geocode.ts` — `AddressSuggestion = {label, street, number, neighborhood, cep}` (sem coord). `parseAutocomplete` já testado.

## Files
- `lib/geocode.ts` — ADD export `sugestaoParaGeocodeInput(s): GeocodeInput` (mapeia sugestão → input preciso do geocoder; invariant: não inclui lat/lon, pois `AddressSuggestion` não tem).
- `lib/geocode.test.ts` — TDD: test `sugestaoParaGeocodeInput` (round-trip de campos; não expõe lat/lon).
- `app/[slug]/checkout.tsx` — dropdown + remove `geoOrigem` dead state.

## Implementation (for subagent)

### Task 1 — `sugestaoParaGeocodeInput` (TDD)
- `lib/geocode.ts`:
```ts
// Mapeia uma sugestão do dropdown (sem coordenada) no input PRECISO do geocoder.
// A origem do pino vem do forward-geocode (LocationIQ search), nunca do autocomplete.
export function sugestaoParaGeocodeInput(s: AddressSuggestion): GeocodeInput {
  return {
    cep: s.cep || undefined,
    street: s.street || undefined,
    number: s.number || undefined,
    neighborhood: s.neighborhood || undefined,
  };
}
```
- `lib/geocode.test.ts`: failing test primeiro → `sugetaoParaGeocodeInput({label:"Rua Jerusalém, 1", street:"Rua Jerusalém", number:"1", neighborhood:"Coroado", cep:"69082150"})` → `toEqual({cep:"69082150", street:"Rua Jerusalém", number:"1", neighborhood:"Coroado"})`. Then implement → PASS. (Total tests → 15.)

### Task 2 — checkout.tsx: dropdown + remove geoOrigem
1. **Remove `geoOrigem` dead state** (lint `no-unused-vars`): apagar decl `const [geoOrigem, setGeoOrigem] = …` (linha ~53) + 4 chamadas `setGeoOrigem(...)` (linhas ~121, 156, 190, 357). `geoAviso` continua carregando o sinal. `buscarEndereco` continua usando `b.origem` para o aviso.
2. **Import** `GeocodeInput, AddressSuggestion, sugestaoParaGeocodeInput` de `@/lib/geocode`.
3. **Estado dropdown:** `const [sugestoes, setSugestoes] = useState<AddressSuggestion[]>([]);`, `const [sugestaoAberta, setSugestaoAberta] = useState(false);`, refs `sugestaoBoxRef`, `sugestaoDebounceRef`.
4. **`onEnderecoChange`** (onChange do input "Endereço completo"): setEndereco(v); se v.trim().length < 3 → setSugestoes([]) + setSugestaoAberta(false); senão debounce 300ms → fetch `/api/geo/autocomplete?q=${encodeURIComponent(v.trim())}&hood=${encodeURIComponent(neighborhoods.find(n=>n.id===bairro)?.name ?? "")}` → setSugestoes(b.suggestions||[]); setSugestaoAberta(true). (Reaproveita `debounceRef` existente? Não — usar ref próprio para não colidir com o quote debounce.)
5. **Render:** dentro do `label.form-field.full-width` do endereço, posição relativa; abaixo do input, `ul[role="listbox"]` com `ref={sugestaoBoxRef}`, max-height + overflow-y auto, border `--color-border`, bg card, z-index alto. Cada `li[role="option"]` com `onMouseDown` → `selecionarSugestao(s)` (mousedown, não click, para não perder para o onBlur do input). Estilo inline (igual ao `select`), sem novos arquivos CSS.
6. **`selecionarSugestao(s)`:** `setEndereco(s.label || [s.street,s.number].filter(Boolean).join(", "))`; `setSugestaoAberta(false); setSugestoes([]);` — então resolve pino: `await resolverEndereco(sugestaoParaGeocodeInput(s))`. NÃO usa `s.lat`/`s.lng` (não existem).
7. **Esc + click-away:** `useEffect` com `document` — Escape → fecha; mousedown fora de `sugestaoBoxRef` → fecha.
8. **Refatorar `buscarEndereco`:** extrair corpo em `async resolverEndereco(input: GeocodeInput)` (fetch geocode + setCoords + setGeoAviso conforme origem). `buscarEndereco` (botão) text-prepara `{cep, street: endereco fatiado, number: regex, neighborhood: hood}` e chama `resolverEndereco`. `selecionarSugestao` chama `resolverEndereco(sugestaoParaGeocodeInput(s))`. Mesmo código de fetch, dois callers. (Remoção do `setGeoOrigem` aqui.)

### Task 3 — verificação
- `npx tsc --noEmit` → limpo.
- `npx eslint app/[slug]/checkout.tsx lib/geocode.ts lib/geocode.test.ts` → 0 erros (confirma `geoOrigem` fora).
- `npx vitest run lib/geocode.test.ts` → 15 pass.
- **Live self-check (evidência):** `npm run dev` (porta 3000) → curl `GET /api/geo/autocomplete?q=Rua%20Jerusal%C3%A9m&hood=Coroado` → `≤6` sugestões, cada uma com `street/number/cep`, **sem** lat/lng no output → `POST /api/geo/geocode {cep,street,number,neighborhood:"Coroado"}` → responde `{lat, lng, origem:"enderecura"}` com `lat≈-3.0896424, lng≈-59.9790003`. Se o probe não rodar (sem rede/KEY), o teste da Task 1 + o teste AC3 existente (`só CEP usa a rua → origem 'enderecura'`) já sustentam a precisão.

## Acceptance Criteria
- AC1: ≥3 caracteres → dropdown abre; ≤6 sugestões; loading sutil.
- AC2: selecionar sugestão → `endereco` preenchido + pino via `/api/geo/geocode` (origem `enderecura`); NÃO usa lat/lon do autocomplete.
- AC3: Manaus "Rua Jerusalém/Coroado" → pino ≤1 km de `(-3.0896424, -59.9790003)`.
- AC4: Esc / click-fora → dropdown fecha.
- AC5: autocomplete empty/falha → dropdown vazio, input intacto (nada quebra).
- AC6: `geoOrigem` removido → lint checkout.tsx = 0 erros.
- AC7: `sugestaoParaGeocodeInput` coberto por teste.

## Constraints
- No new deps. Inline styles only (match `select` pattern). No new CSS files.
- No commit. No server route changes (autocompleter + geocoder já corretos).
- a11y mínima: `role="listbox"`/`role="option"`, Escape, click-away.
