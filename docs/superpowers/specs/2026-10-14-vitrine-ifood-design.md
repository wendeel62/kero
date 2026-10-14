# Design — Vitrine iFood-like para o Kero

**Status:** para revisão do dono

## Intent

Copiar o visual e a experiência da vitrine pública do `cardapio-digital` (design iFood-like: amarelo `#FFCE12`, vermelho `#EA1D2C`, mobile-first, bottom-sheet, cards de produto) e aplicar sobre a vitrine existente do kero (`app/[slug]/`), mantendo:

- Rotas e API existentes do kero (Next.js App Router)
- Modelo multi-store (cada loja tem seu slug)
- Toda a funcionalidade atual (checkout, pedido, tracking, LGPD)

## Goals

- Vitrine visualmente idêntica ao cardapio-digital (design system, componentes, animações)
- Manter compatibilidade total com rotas/API existentes do kero
- Multi-store preservado (slug por loja)
- Acessibilidade WCAG (44px targets, foco visível, prefers-reduced-motion)
- Zero breaking changes para lojas existentes

## Non-goals (v1)

- Não copiar o backend Express do cardapio-digital (kero já tem API routes)
- Não copiar o admin do cardapio-digital (kero já tem painel)
- Não mudar o schema do banco (Supabase já tem as tabelas necessárias)
- Não copiar testes do cardapio-digital (kero tem suíte própria)
- Não implementar novos componentes além dos existentes (adaptar os atuais)

## Anti-goals

- Não quebrar URLs existentes (`/[slug]`, `/[slug]/checkout`, etc.)
- No need to create a "Kero" brand text in the vitrine (remove the current "Kero." header text and put store name only)
- Não introduzir dependências novas (Tailwind, CSS puro)
- Não criar um design system separado (adaptar o que já existe)

## Constraints

- Vitrine usa Tailwind utility classes (não CSS puro como o cardapio-digital)
- Kero é Next.js 15 App Router (não SPA com estado interno)
- API do kero: `POST /api/orders`, `GET /api/orders/track/[token]`, `/api/geo/geocode`, `/api/geo/autocomplete`
- Autenticação: Supabase Auth (admin), público sem auth (vitrine)
- Mapa: Leaflet + OpenStreetMap (já no checkout)

## Decisões (minhas, o dono pode revisar)

1. **Manter Tailwind** — não migrar para CSS puro. As classes Tailwind existentes já são mobile-first e responsivas. O visual iFood-like é alcançado trocando a paleta de cores e ajustando os componentes.

2. **Paleta de cores** — trocar `#f4f1ec` (off-white atual) por `#F7F7F7`, trocar gradientes `from-red-700 via-red-500 to-orange-400` por `#EA1D2C` sólido, trocar `yellow-300` por `#FFCE12`. O verde de sucesso permanece (`green-600`/`green-800`). Alertas de loja fechada permanecem `amber-*`.

3. **Bottom-sheet vs páginas** — o cardapio-digital usa bottom-sheet para modais (produto, carrinho). O kero usa páginas separadas. Decisão: **manter páginas separadas** (não converter para bottom-sheet), pois exigiria reescrever toda a navegação. O Goal "visualmente idêntica" refere-se a **cores, tipografia, border-radius, sombras, animações** — não ao padrão de navegação. O bottom-sheet fica para Fase 2 (se o dono quiser).

4. **Sacola flutuante** — o cardapio-digital tem sacola flutuante na vitrine. O kero já tem barra fixa inferior com "Ver sacola". Decisão: **manter a barra existente**, apenas ajustar o visual (vermelho `#EA1D2C` sólido em vez de gradiente).

5. **Stepper de progresso do pedido** — o cardapio-digital tem stepper visual com 5 etapas (Recebido → Preparando → Pronto → Saiu p/ Entrega → Entregue). O kero tem **dois steppers diferentes**: (a) stepper de **etapas do carrinho** (Sacola→Checkout→Receber) em carrinho/pedido, e (b) stepper de **progresso do pedido** (barra de 5 segmentos) em `pedido-client.tsx`. Decisão: **manter ambos**, ajustar cores e ícones para match.

6. **Header da vitrine** — o cardapio-digital tem header fixo com busca e nome da loja. O kero tem header com "Kero." + busca. Decisão: **remover "Kero."** da vitrine, colocar nome da loja no lugar. Ajustar badge "Aberto" para verde e "Fechada" para vermelho `#EA1D2C`.

7. **Cards de produto** — o cardapio-digital tem cards com imagem 112×112, nome, descrição, preço, botão "+". O kero já tem cards similares. Decisão: **ajustar visual** (border-radius `12px` para cards, `10px` para botões, sombra sutil, hover com borda amarela `#FFCE12`).

8. **Border-radius** — padronizar: cards `12px` (Tailwind `rounded-xl`), botões `10px` (Tailwind `rounded-lg`), pills/badges `999px` (Tailwind `rounded-full`). O `tokens.css` define `--radius-card: 14px` mas vamos usar `12px` para match iFood.

9. **Checkout** — o cardapio-digital tem checkout em página única com quote do servidor. O kero já tem checkout similar. Decisão: **ajustar visual** (cards de seleção com borda vermelha `#EA1D2C` quando selecionados, quote em card branco, recibo com `.receipt-div` ajustado para nova cor de fundo).

10. **Tracking do motoboy** — o cardapio-digital usa OpenStreetMap iframe. O kero usa Leaflet no checkout. Decisão: **manter Leaflet** (não migrar para iframe), pois já está integrado. No pedido, o tracking já existe via polling.

11. **CookieBanner/LGPD** — o cardapio-digital tem banner de consentimento LGPD. O kero já tem consentimento no checkout. Decisão: **manter o consentimento existente**, não copiar o banner (kero não tem banner de cookies separado).

12. **Responsividade** — manter breakpoints atuais (`max-w-3xl` para produto/pedido, `max-w-5xl` para carrinho/checkout, `max-w-6xl` para vitrine). O cardapio-digital usa `max-width: 480px` mobile-first, mas o kero já tem layout responsivo com breakpoints diferentes. Não padronizar para 480px.

13. **menu-data.ts mock** — manter mock hardcoded (fase visual). O mock já tem tipos corretos e dados demo. Conexão com Supabase é trabalho futuro (fora do escopo).

14. **Componentes compartilhados** — ajustar visual de: `PriceChangeDialog` (checkout), `CheckoutMap` (Leaflet, já escuro), `TrackingScripts` (layout, sem mudança), `StatusBadge` (pedido, ajustar cores).

15. **Sistema de preview** — o visual iFood-like deve funcionar com `?demo=1` (carrinho) e `?s=new|confirmed|...` (pedido). Não quebrar esses modos.

16. **receipt-div** — o `globals.css` tem `.receipt-div::before/::after { background: #f4f1ec; }`. Ao trocar o fundo para `#F7F7F7`, o builder deve atualizar essas ocorrências manualmente em `globals.css`.

17. **font-display** — verificar se `font-display` está configurada no `tailwind.config`. Se não estiver, adicionar ou usar `font-sans` como fallback.

## Model

### Dados

Nenhuma mudança de schema. O kero já tem:
- `stores` (slug, nome, logo_url, aberto_fechado, min_order_cents, prep_time_min/max)
- `categories` → `products` → `addon_groups` → `addons`
- `orders`, `order_items`
- `neighborhoods` (taxa por bairro)
- `store_tracking` (Meta Pixel + GA4 IDs)

### API

Rotas existentes do kero (sem mudanças):
- `GET /api/geo/geocode` — CEP + rua → coords
- `GET /api/geo/autocomplete` — sugestões de rua
- `POST /api/orders` — cria pedido
- `GET /api/orders/track/[token]` — tracking do pedido
- `POST /api/orders/track/[token]` — cancelar pedido

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `app/[slug]/vitrine-client.tsx` | Ajustar paleta, cards, badges, stepper |
| `app/[slug]/produto/[id]/produto-client.tsx` | Ajustar paleta, badges, stepper |
| `app/[slug]/carrinho/carrinho-client.tsx` | Ajustar paleta, cards, stepper |
| `app/[slug]/checkout/checkout-client.tsx` | Ajustar paleta, cards de seleção, quote |
| `app/[slug]/pedido/[token]/pedido-client.tsx` | Ajustar paleta, stepper de progresso |
| `app/[slug]/menu-data.ts` | Nenhuma mudança (tipos e mock) |
| `app/[slug]/layout.tsx` | Nenhuma mudança (TrackingScripts) |

### Arquivos a criar

Nenhum. Todos os componentes já existem.

## Verificação

1. `npm run build` — deve passar sem erros
2. `npm run test` — suíte existente deve passar
3. Verificar visualmente no navegador (screenshots antes/depois)
4. Testar fluxo completo: vitrine → produto → carrinho → checkout → pedido

## Riscos conhecidos

- A vitrine usa Tailwind hardcoded (não tokens CSS). Mudar a paleta exigirá buscar e substituir todas as ocorrências de `red-600`, `red-700`, `#f4f1ec`, etc.
- O design do cardapio-digital é mobile-first com `max-width: 480px`. O kero usa `max-w-6xl` (desktop) e mobile. A responsividade já existe mas com breakpoints diferentes.
- O cardapio-digital usa animações CSS customizadas (`.anim-rise`, `.anim-pop`, `.anim-drift`, `.live-dot`, `.texture-dots`, etc.) que estão no `app/globals.css` ou `app/_design/` do kero? Verificar.

## O que fica para o builder

1. Substituir todas as ocorrências de cores hardcoded pela paleta iFood-like
2. Ajustar border-radius dos cards (12px) e botões (10px)
3. Ajustar sombras e bordas para match
4. Verificar animações (`.anim-rise`, `.anim-pop`, `.anim-drift`, `.live-dot`, `.texture-dots`, `.marquee-track`, `.receipt-div`, `.btn-shine`, `.no-scrollbar`, `.dish-card`, `.texture-grain`)
5. Testar build e suíte
6. Capturar screenshots para comparação

## Fase 2 (se aprovado)

- Bottom-sheet para modais (produto, carrinho) — reescrever navegação
- Mapa do motoboy no pedido (Leaflet) — já existe no checkout, mas não no pedido
- Promoções/ofertas do dia — novo campo no schema
- Cupom de desconto — novo campo no schema
- Avaliações/reviews — novo campo no schema
