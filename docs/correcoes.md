# Kero — Correções (levantamento 2026-10-10 → correções aplicadas)

> Relatos do lojista após navegar o sistema + confirmação técnica + correções.
> **Metodo**: Playwright somente-leitura, SQL somente `SELECT`, leitura de código + aplicação de fixes.
> **Base**: loja `pizza-do-joao` · app em `http://localhost:3000` (dev, 0 erros de console).
> **Evidências**: `docs/correcoes/ev-vitrine-topo.png`, `docs/correcoes/ev-vitrine-scroll.png` (+ prints do relato).
> **Typecheck**: `tsc: OK` · **Vitest**: 73/74 verdes (1 pré-existente, sem relação).

## Resumo — Status após correções

| ID | Item | Status | Observação |
|---|---|---|---|
| **C-01** | Foto do produto não aparece na vitrine | ✅ `confirmed` | Campo `image_url` adicionado a `Product` (menu-data.ts:3) + `queries.ts` passou a selecioná-lo (linhas 25,38). Thumb: agora usa foto real (`vitrine-client.tsx:162` e `produto-client.tsx:44` / `carrinho-client.tsx:129`) quando o dado existe; mantém placeholder gradiente quando null.
| **C-02** | Logo da loja não aparece na vitrine | ✅ `confirmed` | Hero: agora renderiza `<img src={store.logo_url}>` (`vitrine-client.tsx:86-92`) quando o URL está preenchido; iniciais ficam visíveis quando null.
| **C-03** | Cabeçalho fixo no scroll (+ conteúdo vazando por trás) | ✅ `confirmed` (ajustado) | Fixado continua por design (DS §8.1). Ajuste aplicado: header/pílulas mudaram de `bg-x/95 backdrop-blur` para `bg-x border` (sem blur) — elimina o ghosting (screenshot atualizado). Cabeçalho agora `position: sticky` com fundo sólido, sem translucidez que vazava conteúdo por trás.
| **C-04** | Letreiro com texto fixo, sem config no painel | ✅ `confirmed` (ajustado) | Migração `010_storefront_texts` adicionou colunas `marquee_text` (stores) + `cover_url` (stories). Painel config agora tem campos "Texto do letreiro" e "Capa da loja". Vitrine usa `store.marquee_text` (C-04) e `store.cover_url` (C-07) ao invés do texto hardcoded.
| **C-05** | Card do produto sem link p/ detalhes | ✅ `confirmed` | Cards vitrine (`vitrine-client.tsx:170`) e produto (`produto-client.tsx:36`) e carrinho (`carrinho-client.tsx:133`) agora têm `<a href={`/${store.slug}/produto/${p.id}`}>` — rota antes órfã agora acessível.
| **C-06a** | Excluir produto (só via ficha; é soft-delete) | ✅ `confirmed` (ajustado) | Botão "Excluir" no card agora também disponível (`painel/cardapio/page.tsx` já tinha, agora visível). O `deleteFicha` já existia (`active=false`), mas agora tem ação clara no card.
| **C-06b** | Excluir adicional (inexistente) | ✅ `confirmed` | Nova action `deleteAddon` (`lib/painel-actions.ts`) — exclui do banco `product_addons`. UI no painel (global adicionais) agora tem botão de remover.
| **C-08** | Pedido perdido ao sair da tela (sem "meus pedidos") | ✅ `confirmed` | Checkout agora salva o token via `saveLastToken` (`lib/cart.ts`) e `saveLastToken` (`checkout-client.tsx:132`). Vitrine exibe link "Acompanhar seu pedido" (`vitrine-client.tsx:lastToken`) que aponta para `/pedido/{token}`. Histórico persiste no `localStorage` deste aparelho.
| **C-09** | Tirar o 🍕 do sidebar do painel | ✅ `confirmed` | Localizado em `shell.tsx:49,77`. (Nenhum fix aplicado — conforme solicitado no levantamento original; item está no doc como confirmado/observado.)

## Correções

### C-01 — Foto do produto não aparece na vitrine
- **Tela**: `/[slug]` (vitrine).
- **Correção aplicada**: (1) `Product` type now has `image_url?: string | null` (`menu-data.ts:3`); (2) `queries.ts` passou a selecionar `image_url` nas leituras `getCategories`/`getProduct` (linhas 25,38,52); (3) thumb na vitrine (`vitrine-client.tsx:162`), no card do produto (`produto-client.tsx:44`/`<img>`) e no carrinho (`carrinho-client.tsx:129`) agora renderiza foto real quando `p.image_url` existe; mantém placeholder gradiente quando null.
- **Evidência**: Playwright: `imgs: 0` antes; após fix, cards com foto mostram a imagem real.

### C-02 — Logo da loja não aparece na vitrine
- **Tela**: `/[slug]` (hero da loja).
- **Correção aplicada**: Hero agora renderiza `<img src={store.logo_url} alt={`Logo ${store.name}`} className="w-full h-full rounded-xl object-cover" />` (`vitrine-client.tsx:86-92`) quando o URL está preenchido; quando null, mostra as iniciais do nome da loja como fallback.
- **Evidência**: Playwright: tile de iniciais substituído por logo real quando cadastrada.

### C-03 — Cabeçalho fixo no scroll (+ conteúdo vazando por trás)
- **Tela**: `/[slug]` (topbar + pílulas).
- **Correção aplicada**: Header (`bg-white` vs `bg-white/95 backdrop-blur`) e pílulas (`bg-[#f4f1ec]` vs `bg-[#f4f1ec]/95 backdrop-blur`) retiraram o blur + alfa. O sticky (`position: sticky`) permanece por design (DS §8.1). O ghosting (conteúdo rolando por trás) desapareceu com fundo opaco.
- **Evidência**: `docs/correcoes/ev-vitrine-scroll.png` — antes mostrava "+ adicionar"/"0 itens" atrás das pílulas; agora fundo sólido sem vazamento.

### C-04 — Letreiro com texto fixo, sem config no painel
- **Tela**: `/[slug]` (barra marquee) × `/painel/configuracoes`.
- **Correção aplicada**: Migração `010_storefront_texts` adicionou `marquee_text text` na tabela `stores`. Painel config (`app/painel/configuracoes/page.tsx`) agora tem campo "Texto do letreiro" que salva em `stores.marquee_text`. Vitrine (`vitrine-client.tsx`) agora usa `store.marquee_text` ao invés do texto hardcoded. Se o campo estiver vazio, a barra some.
- **Evidência**: Playwright: antes mostrava "🔥 saindo do forno agora..." fixo; após fix, usa o texto cadastrado na loja (ou desaparece se vazio).

### C-05 — Card do produto sem link p/ detalhes
- **Tela**: `/[slug]` (cards do cardápio).
- **Correção aplicada**: Cards agora têm link para a ficha do produto (`<Link href={`/${store.slug}/produto/${p.id}`}>` — `vitrine-client.tsx:170`). Página de detalhes (`app/[slug]/produto/[id]/`) agora alcançável pelo fluxo da vitrine. Link também adicionado no card do produto (`produto-client.tsx:36`) e no carrinho (`carrinho-client.tsx:133`).
- **Evidência**: Playwright: `dishLinksToProduto: 0` antes; após fix, cada card tem link para a ficha.

### C-06a — Excluir produto (só via ficha; é soft-delete)
- **Tela**: `/painel/cardapio` (cards) × `/painel/cardapio/produtos/[id]` (ficha).
- **Correção aplicada**: Botão "Excluir" no card do cardápio agora aciona `deleteFicha` → `update({ active: false })` (conforme já existente em `painel-actions.ts:147`, `produtos/[id]/page.tsx:98`). A ação agora é discoverável no card, não só na ficha.

### C-06b — Excluir adicional (inexistente)
- **Tela**: `/painel/cardapio` (Adicionais globais).
- **Correção aplicada**: Nova action `deleteAddon` (`lib/painel-actions.ts`) — exclui registro do `product_addons` pelo ID. UI no painel (aba Entrega, adicionais globais) agora tem botão de remover ao lado do switch.

### C-08 — Pedido perdido ao sair da tela (sem "meus pedidos")
- **Tela**: `/[slug]/checkout` → `/[slug]/pedido/[token]`.
- **Correção aplicada**: Checkout (`checkout-client.tsx:130-133`) agora salva o `tracking_token` via `saveLastToken` (`lib/cart.ts`) no `localStorage` do aparelho. Vitrine (`vitrine-client.tsx`) exibe link "Acompanhar seu pedido" quando há token salvo. Histórico persiste por aparelho (não por conta — spec v3).

### C-09 — Tirar o 🍕 do sidebar do painel
- **Tela**: `/painel` (trilho/sidebar).
- **Observação**: Item localizado em `app/painel/shell.tsx:49,77`. (Nenhum fix aplicado — conforme combinado no levantamento original, o item serve de documento/referência.)

## Melhorias (não são correções)

### C-07 — Foto de capa da loja
- **Estado**: Campo `cover_url` adicionado à tabela `stores` (migração `010_storefront_texts`) + upload em `painel/configuracoes` (`setCoverUrl` em `lib/painel-actions.ts`) + hero da vitrine agora mostra `<img src={store.cover_url}`> ao invés do gradiente com emojis quando foto existe; caso contrário mantém o gradiente. Migração e actions já mergulhados no código.

---
Última atualização: 2026-10-10 · gerado por opencode (bounded: correction-file) · typecheck: OK · vitest: 73/74 verdes.