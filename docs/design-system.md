# Kero — Design System (base p/ o SaaS)

> Fonte de verdade visual do projeto. A vitrine (`app/[slug]/`) é a implementação
> de referência — todo componente novo do SaaS (painel, admin, checkout, tracking)
> deve reutilizar estes tokens e padrões antes de inventar algo novo.
> Spec de negócio: `docs/superpowers/specs/2026-10-04-saas-delivery-design-v3.md`.

## 1. Stack e arquivos

- Next.js 15 App Router + React 19 + TS + Tailwind v4 (`@import "tailwindcss"`) + fontes via Google Fonts (`Inter` + `Sora`).
- `app/layout.tsx` — html `pt-BR`, metadata base, importa `globals.css`.
- `app/globals.css` — tokens + keyframes + utilitários (único lugar de CSS global).
- `app/[slug]/page.tsx` — server: metadata OG (nome/descrição da loja), lookup via `menu-data`, `notFound()` p/ slug desconhecido/inativo.
- `app/[slug]/menu-data.ts` — **única fonte do cardápio demo**: tipos, `STORES`, `GLOBAL_ADDONS`, `getEntry`, `findProduct`, `brl`, `norm`. Vitrine, produto e (futuro) carrinho consomem daqui.
- `app/[slug]/produto/[id]/page.tsx` — server: metadata OG por produto, `notFound()` p/ id/loja inválida.
- `app/[slug]/produto/[id]/produto-client.tsx` — client: adicionais, recado, qtd, total; grava em `lib/cart` e vai p/ sacola.
- `app/[slug]/carrinho/page.tsx` + `carrinho-client.tsx` — server valida loja; client resolve linhas × cardápio, steppers, resumo, mínimo, CTA checkout.
- `app/[slug]/checkout/page.tsx` + `checkout-client.tsx` — server valida loja + bairros mock; client: form completo, validações da spec, recibo escuro, painel demo no envio.
- `app/[slug]/pedido/[token]/page.tsx` + `pedido-client.tsx` — server valida loja; client: timeline, polling 15s, cancelar demo, wa.me. Mock `demoOrder()` em `menu-data`.
- `app/painel/layout.tsx` — sidebar escura desktop + topbar mobile (Hoje, Pedidos, Cardápio, Config).
- `app/painel/mock.ts` — `TODAY_ORDERS`, `STATUS_PT`, `STORE_NAME` (demo até Auth/RLS/Realtime).
- `app/painel/page.tsx` — Hoje: cards, últimos 5, toggle `force_closed` demo.
- `app/painel/pedidos/page.tsx` — Kanban: colunas, máquina de estados demo, cancelar com motivo, cancelados colapsados.
- `app/painel/pedidos/[id]/page.tsx` — Detalhe: cliente, itens snapshot, timeline com actor, avançar/cancelar/imprimir.
- `app/painel/pedidos/[id]/print/page.tsx` — Cupom 80mm standalone (layout pula sidebar em `*/print`).
- `app/painel/cardapio/page.tsx` — Cardápio: categorias arrastáveis, toggles, adicionais globais.
- `app/painel/cardapio/produtos/[id]/page.tsx` — Ficha: foto ≤1MB, dados, preço→centavos, adicionais, salvar demo.
- `app/painel/configuracoes/page.tsx` — Config: abas Loja/Horários/Entrega, editor de faixas, bairros, mínimo/preparo.
- `app/admin/` — shell do operador + `mock.ts`; `admin/page.tsx` redireciona; `lojas/page.tsx` lista + criar com senha provisória; `lojas/[id]/page.tsx` toggle active, reset senha, anonimizar LGPD.
- `ITEM_SETS` em `mock.ts` compartilhado entre detalhe e cupom.
- `lib/cart.ts` — sacola: `CartLine`, `addLine` (mescla mesma linha), `setQty`, `removeLine`, `countItems`, `loadCart`/`saveCart` (`kero:cart:v1:<slug>`). Limites da spec: 30 linhas, qty 1–20.
- **Env vars** e **migrações** não são decididas aqui: tabela completa na spec §13 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_SALT_ROTATION_ENABLED`, `NEXT_PUBLIC_APP_NAME`); migrações via Supabase CLI em `supabase/migrations` (`supabase db push`, `supabase migration new`). Service role é server-side only.

## 2. Tokens

| Token | Valor | Uso |
|---|---|---|
| Fundo app | `#f4f1ec` | fundo quente (não cinza puro) |
| Card | `#fff` + `border` + `rounded-3xl` + `shadow-sm` | seções, hero, aside |
| Primário | `red-600 #dc2626` → gradiente `from-red-700 via-red-600` | CTAs, sacola, selo MAIS PEDIDA |
| Texto | `stone-900` / `stone-500` secundário / `stone-400` terciário | hierarquia |
| Sucesso | `green-100/800`, dot com `live-dot` | "Aberta agora" |
| Acento | `amber-200` (letreiro), `yellow-300` (selo rating) | detalhes, nunca grandes áreas |
| Fonte texto | `Inter` | corpo, inputs, preços (`tabular-nums`) |
| Fonte display | `Sora` (`font-display`, `font-extrabold`, `tracking-tight`) | `h1/h2`, números grandes |
| Raio | `rounded-3xl` seções · `rounded-2xl` thumbs/sacola · `rounded-full` pílulas/busca | — |
| Container | `max-w-6xl` header e main (`px-4`); mobile usa coluna única | desktop expande em grid, nunca estica texto |

### 2.1 Tokens `dark:` (preparados — não usados no v1, mas definidos)

| Token (dark) | Valor | Uso |
|---|---|---|
| Fundo app (dark) | `#1c1917` (`stone-950`) | `bg-white dark:bg-stone-950` |
| Card (dark) | `#292524` (`stone-900`) | `bg-white dark:bg-stone-900` |
| Primário (dark) | `red-500 #ef4444` | `bg-red-600 dark:bg-red-500` |
| Texto primário (dark) | `#fafaf9` (`stone-50`) | `text-stone-900 dark:text-stone-50` |
| Texto secundário (dark) | `#a8a29e` (`stone-400`) | `text-stone-500 dark:text-stone-400` |
| Borda (dark) | `#44403c` (`stone-800`) | `border-stone-200 dark:border-stone-800` |
| Sucesso (dark) | `green-500 #22c55e` | `text-green-800 dark:text-green-500` |

## 3. Motion (CSS puro, sem libs — `globals.css`)

- `anim-rise` (entrada em cascata, delay inline `min(i,8)*60ms`) · `anim-pop` (logo, contador) · `anim-bar` (sacola mobile) · `drift` (só `translateY`, sem rotação) · `marquee-x` 22s (letreiro) · `live-dot` (pulso do status).
- **Selos são estáticos por decisão** (rating `★ 4.9`, `MAIS PEDIDA`): sem rotação/flutuação; hover no máximo realça sombra. Manter assim.
- Hover permitido: `.dish-card` sobe 2px + sombra; `.dish-thumb` escala 1.06; botão `+ adicionar` inverte p/ sólido.
- Sempre respeitar `prefers-reduced-motion` (bloco já existe no CSS — replicar p/ animações novas).
- Premium: `btn-shine` (varredura no CTA, 4s) e `receipt-div` (separador de recibo com recortes — recortes usam a cor do fundo da página; card precisa `p-6`).

### 3.1 Acessibilidade (obrigatório — já vale para o que existe)

- **Toast / novo pedido / coluna Kanban**: `aria-live="polite"` na região que muda sozinha. O cliente precisa saber do status novo sem olhar para a aba.
- **Contador da sacola**: `role="status"` — é a única informação viva da vitrine.
- **Foco**: `focus-visible` visível em **todo** elemento focável (o padrão já está no código: 10 ocorrências, não remover); nunca `outline: none` sem substituto.
- **Labels**: todo input com `<label htmlFor>` + `id` correspondente (inclusive os campos "sem nome visual" como busca e Complemento, que usam `aria-label`).
- **Etapas do stepper / linha do tempo**: `<ol>` com `aria-label` (padrão já no stepper do checkout e do tracking).
- **Contraste AA** no texto secundário (`stone-500`) e nos placeholders (`stone-400`) sobre `#f4f1ec` — `stone-400` só em texto decorativo.
- Botão só com ícone → `aria-label` (padrão já no "←" do topo).

## 4. Catálogo de componentes (reutilizar em toda página nova)

1. **Topbar sticky** (`z-40`, `bg-white/95 backdrop-blur`): voltar ← · `Kero.` (Sora, ponto vermelho) · busca pill com ⌕ e ✕ p/ limpar. Faixa `h-1` gradiente no topo.
2. **Letreiro**: barra `stone-900`, texto `amber-200/90`, `marquee-track` com conteúdo duplicado (taxa, tempo, diferenciais).
3. **Hero da loja** (card `rounded-3xl`): capa `h-36 sm:h-44` gradiente red→orange + `texture-dots` + `texture-grain` + emojis ambientes; logo 72px sobreposto (`-mt-8`, `anim-pop`); eyebrow vermelho (`FORNO A LENHA · DESDE 2016`); `h1` Sora 26px; chips (status/aberta, tempo, taxa, mínimo); selo rating amarelo estático; banner tracejado âmbar quando fechada.
4. **Pílulas de categoria**: abaixo do hero, `sticky top-[85px] z-30` sobre `bg-[#f4f1ec]/95 backdrop-blur`; ativa `bg-stone-900 text-white shadow`, demais brancas. Âncoras `#cat-<id>` com `scroll-mt-40`.
5. **Item do prato**: nome + descrição `line-clamp-2` + preço bold `tabular-nums`; thumb 96×80 com gradiente rotativo (`THUMBS[i]`) + emoji `drop-shadow`; botão `+ adicionar` (outline vermelho → sólido no hover, `active:scale-95`, `disabled:opacity-30`); inativo: `opacity-50 saturate-50` + itálico "pausado pelo pizzaiolo".
6. **Paginação**: 12 itens/categoria (`PAGE_SIZE`), "ver todos os N sabores +".
7. **Sacola mobile**: `lg:hidden`, fixa, gradiente vermelho, contador com `key={qty}` p/ `pop`, `pb=safe-area`.
8. **Aside desktop** (`hidden lg:block`, `sticky top-[104px]`): card escuro "sua sacola" (contador grande + CTA) + card "sobre a loja". Grid: `lg:grid-cols-[minmax(0,1fr)_320px]`.
9. **Lista desktop**: `sm:grid-cols-2` com `sm:divide-y-0` + `sm:border-b dashed` por item.
10. **Página do produto**: foto grande (`h-56 sm:h-72`) com ambientes + chip categoria + selo preço; título + selo ★ + faixa infos (tempo, taxa, "serve bem 2"); seções numeradas (1 Adicionais com highlight `bg-red-50/60` no marcado, 2 Recado com contador); barra total fixa com linha de composição (`N × base+adicionais`).

11. **StatusBadge** (7 estados reutilizáveis — espelha a máquina de estados da spec §6):
    - `new` → `bg-red-50 text-red-700 border-red-200` "Novo"
    - `confirmed` → `bg-amber-50 text-amber-700 border-amber-200` "Confirmado"
    - `preparing` → `bg-blue-50 text-blue-700 border-blue-200` "Em preparo"
    - `ready` → `bg-green-50 text-green-700 border-green-200` "Pronto"
    - `out` → `bg-green-50 text-green-700 border-green-200` "Saiu p/ entrega"
    - `delivered` → `bg-stone-100 text-stone-700 border-stone-200` "Entregue"
    - `cancelled` → `bg-stone-900 text-white` "Cancelado"
    - Props: `status`, `size?` (`sm`|`md`), `showDot?` (live-dot no `new`)

12. **ImageUploader** (reutilizável em Ficha Produto, Config Loja, Admin Logo):
    - Drag-drop + click p/ selecionar
    - Prévia imediata (object URL)
    - Validação client-side: tipo `image/*`, ≤1MB de entrada
    - Compressão canvas → WebP (qualidade 80–100, redimensiona p/ largura máx 1200px) em `lib/image.ts`
    - Erro PT-BR: "Arquivo muito grande (máx 1MB após compressão)" / "Formato inválido" (SPEC v3.1 #8 — dimensão nunca rejeita, sempre redimensiona)
    - Retorna `File` WebP pronto p/ upload no bucket `store-assets/logos/{store_id}/logo.webp` ou `store-assets/products/{store_id}/{product_id}.webp` (SPEC v3.1 #4)

13. **Tokens `dark:` preparados** — ver seção 2.1 acima (não usados no v1, mas definidos para future-proof).

## 5. Regras de negócio visíveis (da spec, já aplicadas)

- Slug inativo/inexistente → `404` (`notFound()`); `/` → redirect p/ loja demo.
- Busca: `normalize("NFD")` sem acento + `toLowerCase`, nome + descrição; vazio com personalidade + "limpar busca".
- Fechada: banner + CTAs desabilitados, carrinho mantido.
- Preço: `Intl pt-BR BRL` a partir de centavos (`int`); pedido mínimo exibido, validação real no servidor (fase checkout).

## 6. O que falta (não inventar — seguir a spec)

- Fotos reais via Storage WebP ≤1MB/1200px (thumbs emoji são placeholder). A compressão é **client-side** (canvas → WebP, largura máx. 1200px, qualidade 80–100) em `lib/image.ts`; o bucket só recebe o arquivo já comprimido.
- Backend (Supabase Auth/RLS + `POST /api/orders` + Realtime) — o front já deixa os pontos marcados.
- API `POST /api/orders` (fase backend): o checkout valida no client e mostra painel demo; o envio real, recálculo via `pricing.ts`, rate limit e dedup entram lá. **Os estados de erro da spec §9 (detalhados em §8.4) só existem depois dessa API** — não antecipar copy agora.
- **Som do painel** (spec §11): toque curtíssimo, **≤150ms**, disparado só **após gesto do usuário dentro do painel** (browsers bloqueiam autoplay; é requisito do risco nº 1). Entra junto com o Realtime.
- **Badge na aba/favicon** (spec §11): número de pedidos aguardando ação desenhado em **canvas** (número sobre fundo vermelho) → `toDataURL` no `<link rel="icon">`, refeito a cada mudança de estado. Título (`document.title`) acompanha com o mesmo contador.
- **"Reconectando"**: se o Realtime cair, mostrar o indicador + cair para polling 30s (spec §9).
- Mock → Supabase: trocar `STORES` por `queries.ts` (RLS) + `isStoreOpen` real (`store-hours.ts`, TZ `America/Manaus`).

## 7. Anti-patterns (não fazer)

- Cinza puro de fundo, cards sem raio/sombra, selos inclinados ou flutuando, animações laterais em badges, libs de animação p/ o que CSS resolve, preço em `float`, texto inventado fora da spec, `max-w` maior que `6xl` p/ leitura.

## 8. Páginas (design empilhado — uma seção por página aprovada)

### 8.1 Vitrine (`/[slug]`) — aprovada
Ordem vertical: faixa gradiente `h-1` → topbar sticky (voltar, `Kero.`, busca) → letreiro marquee → cartão hero da loja → pílulas de categoria sticky → seções por categoria (2 col desktop) → bloco "Da nossa porta" → rodapé. Desktop: grid com aside escuro da sacola; mobile: barra de sacola fixa. Usa componentes §4 itens 1–9. Estados: busca vazia com personalidade; loja fechada (banner + CTAs off); produto pausado (apagado + itálico). Chip de taxa: "Entrega a partir de R$ X" (menor `neighborhoods.fee_cents` ativo); loja sem bairros (só retirada) não mostra chip — o `delivery_fee_cents` do mock é só demo, não existe no banco (SPEC v3.1 #16).

### 8.2 Produto (`/[slug]/produto/[id]`) — aprovada
Ordem vertical: faixa gradiente → topbar simples (voltar + nome da loja) → cartão foto (`h-56 sm:h-72`, ambientes flutuantes, chip categoria, selo preço, `★ 4.9`) → título + faixa infos (tempo, taxa, "serve bem 2") → seção 1 Adicionais (checkbox, highlight no marcado) → seção 2 Recado (textarea + contador 200) → barra total fixa (linha de composição + stepper 1–20 + CTA). Sem cross-sell por decisão (removido). Usa tokens §2 e motion §3; reaproveita thumb/texturas da vitrine. Estados: produto pausado e loja fechada desabilitam tudo com aviso; id/loja inválida → 404; metadata OG por produto.

### 8.3 Carrinho (`/[slug]/carrinho`) — aprovada
Ordem: stepper de etapas (Sacola → Checkout → Receber) → faixa da loja (logo, ★, tempo, taxa, link cardápio) → linhas em cards individuais (thumb com ring, `+ adicional` em pills laranja, recado itálico, stepper pill, ✕ em círculo) + **recibo escuro** (`stone-900`, `texture-dots`, divisor `receipt-div` com recortes, total Sora 3xl, CTA com `btn-shine`). Mobile: barra fixa com subtotal + CTA; desktop: recibo `sticky`. Vazia: card com faixa gradiente + 🛒 flutuante + CTA shine. Regras: mesma linha = produto + adicionais + obs (mescla, soma qty); produto fora do cardápio some da lista; CTA off quando vazia/abaixo do mínimo/fechada; taxa real só no checkout (por bairro). Preview cheio: `?demo=1` (só quando vazia; depois vira sacola real).

### 8.4 Checkout (`/[slug]/checkout`) — aprovada
Ordem: stepper (etapa 2 ativa, ✓ na 1) → cards Quem recebe (nome, WhatsApp) → Entrega/Retirada (radio cards; pickup-only automático se 0 bairros ativos; endereço + bairro com taxa + CEP 8 dígitos + complemento) → Pagamento (Dinheiro/Pix/Maquinha, troco só p/ dinheiro) → Observações (300 + aviso LGPD + honeypot `website` oculto) + **recibo escuro** (itens, subtotal, entrega por bairro ou "grátis", total, CTA `Fazer pedido • R$ X`). Mobile: barra fixa com total + CTA (via `form=`). Validações da spec no client (nome 2–80, fone 10–15 dígitos, CEP 8 dígitos obrigatório, mínimo sobre subtotal, troco ≥ total, loja aberta); erros em alerta vermelho listado. Envio mostra painel **demo** (`#DEMO`, `POST /api/orders` entra na fase backend — servidor recalcula tudo).

**Estados de erro do envio (spec §9)** — todos com a mesma forma: alerta PT-BR no topo do form, **carrinho preservado**, sem perder o que o cliente digitou:

| Código | O que a tela mostra |
|---|---|
| `RATE_LIMIT` (429) | "Você já fez muitos pedidos. Tente de novo mais tarde." — sem retry automático |
| `DUPLICATE` (409) | "Já temos um pedido seu nos últimos 60s." **sem link de acompanhamento** + botão verde `wa.me` para falar com a loja |
| `STORE_CLOSED` (409) | "A loja fecha às HH:MM." com o horário do `open_hours` |
| `BAIRROS_NAO_CONFIGURADOS` (422) | "Ainda não há bairros configurados — só retirada." |
| `STORE_NOT_CONFIGURED` (409/500) | "A loja está mal configurada. Tente mais tarde ou fale com o suporte." (SPEC v3.1 #9 — loja sem prep_time; no painel/admin ação é preencher prep_time_min/max) |
| item indisponível (422) | nome do produto: "Calabresa G saiu do cardápio" |
| `TROCO_INSUFICIENTE` (400) | erro no campo de troco, foco nele |
| `PRICE_CHANGED` | diálogo de diff (original × corrigido, item a item) com botão "Confirmar e enviar"; o reenvio leva `confirmedPriceDiff=true`. **Nunca grava o preço velho** |
| loja desativada (404) | `notFound()` — não vaza que a loja existiu |

### 8.5 Acompanhamento (`/[slug]/pedido/[token]`) — aprovada
Ordem: stepper (etapa 3) → **hero escuro de status** (código grande, rótulo PT-BR, promessa de entrega, barra de progresso 5 estágios, emoji de estado) → card detalhes (nome + telefone mascarado, bairro só, pagamento + troco, itens com adicionais, total) → ações (WhatsApp verde `wa.me` com mensagem `#CODIGO`, Cancelar só em `new`/`confirmed` abrindo motivo ≥3 chars). Cancelado: hero alternativo sem cobrança; entregue: parabéns. Polling 15s e cancelamento real entram na fase backend (`GET /api/orders/track/[token]`, `set_order_status … 'customer'`). Previews de estado: `?s=new|confirmed|preparing|out|delivered|cancelled`.

**Promessa de entrega** (`promised_at`, spec §2.27 e §7.4) — sempre as **duas** formas, com o horário absoluto como principal:
- **"chega ~19:40"** — `promised_at` renderizado no fuso `America/Manaus` (o banco grava UTC; a conversão é do cliente).
- **"~25 min"** — apoio, com `live-dot` enquanto o pedido não saiu para entrega.
- Pedido atrasado (`promised_at` no passado e ainda não `delivered`) → "atrasado" em vermelho, sem mudar o layout do hero.
- Cancelado: esconde as duas e mostra só "Sem cobrança — pagamento é só na entrega". Mostra também o motivo (`cancellation_reason`) abaixo do hero — e o mesmo motivo aparece na timeline do detalhe no painel (SPEC v3.1 #14).

### 8.6 Painel Hoje (`/painel`) — aprovada
Shell do lojista: **trilho escuro expansível no hover** desktop (`w-[78px] → 248px`, labels com fade+slide, ícones SVG de traço próprios, badge de novos no ícone de Pedidos, `»` que gira) e topbar + pílulas no mobile. Página: saudação por horário + data, status da loja com dot; **toggle Fechar agora** refinado (vira "Reabrir" verde + banner "Fechada desde HH:MM"); 3 cards com **count-up** e **sparkline** decorativa + **Aguardando ação** em gradiente vermelho com glow (vira link p/ o kanban); Últimos 5 com avatar de inicial, pill de status por cor, `há N min` (vermelho + "precisa de você" após 10 min em `new`) e chevron. Luz ambiente radial sutil. `force_closed` real e contadores via Supabase entram com Auth/RLS.

### 8.7 Kanban (`/painel/pedidos`) — aprovada
Janela = **não finalizados + hoje**, e **"hoje" é o dia em `America/Manaus`, resolvido no servidor** (`lib/store-hours.ts` / `queries.ts`) — nunca no cliente, senão o cliente e o painel discordam na virada da meia-noite. Colunas com scroll horizontal (`snap-x`, 280px): Novos → Confirmados → Em preparo → Pronto/Em rota (`ready`+`out` juntos) → Entregues, + Cancelados de hoje colapsada escura com contador. Card: código, `há N min` (vermelho + 🔴 após 10 min em `new`), "Aguardando X min", nome, pills entrega/retirada + pagamento, total, CTA Avançar (rótulo por etapa; `preparing` vira Pronto p/ retirada e Saiu p/ entrega) + ✕ que abre diálogo de motivo ≥3. Transição re-anima o card (`anim-pop` por `key=id-status`). Realtime, som e badge entram com Supabase; máquina de estados espelha `order-status.ts` da spec.

### 8.8 Detalhe do pedido (`/painel/pedidos/[id]`) — aprovada
Cabeçalho escuro com código gigante + pill de status + chips (tipo, pagamento, total); grid Cliente (nome, fone, wa.me verde, endereço/retirada, pagamento + troco) e Itens (snapshot com adicionais/obs, subtotal/entrega/total); Linha do tempo vertical com dot vivo no atual e `por cliente/loja/sistema`; ações Avançar (rótulo do próximo status) + Cancelar (motivo ≥3) + Imprimir 80mm (liga o cupom). Itens e eventos reais vêm de `order_items`/`order_events` no backend.

### 8.9 Cupom 80mm (`/painel/pedidos/[id]/print`) — aprovada
Página limpa fora da sidebar (layout detecta `*/print`): coluna `w-[80mm]`, `font-mono`, `@page { size: 80mm auto; margin: 0 }` — na impressão some sombra/borda/botões (`.no-print`). Cabeçalho com nome/fone, `#CÓDIGO` gigante, tipo em destaque, cliente em caixa alta, itens com `*** OBS ***`, TOTAL em caixa `====`, troco em destaque, link de acompanhamento real (`kero.app/{slug}/pedido/{tracking_token}` — SPEC v3.1 #10; o demo atual `kero.app/k7m2` é placeholder inválido), rodapé. Botões Voltar + Imprimir (`window.print()`) só em tela.

### 8.10 Cardápio (`/painel/cardapio`) — aprovada
Cabeçalho com contadores (categorias, ativos, teto 200) + CTA Novo produto; **pílulas de categoria arrastáveis** (drag-and-drop com estado fantasma, âncora p/ seção, criar inline); produtos em grade 2 col mobile / 4 col desktop com cards verticais compactos (thumb, nome, preço, switch + Editar); **Adicionais globais** com switch, preço e criar inline (nome + R$). Ordenação e toggles reais entram com `sort_order`/`active` no banco.

### 8.11 Ficha do produto (`/painel/cardapio/produtos/[id]`) — aprovada
`novo` abre em branco, id abre preenchido (404 se inexistente). Seções: Foto (tile clicável com prévia, valida ≤1MB com erro PT-BR, nota WebP/1200px); Dados (nome, descrição, **preço R$ com prévia ao vivo em centavos int**, categoria, ordem, switch À venda/Pausado); Adicionais (globais com checkbox + link de gestão). Salvar valida e mostra painel demo; Excluir (só editando) documenta `active=false`. Upload real e grav persistem no backend (Storage + `products`).

### 8.12 Configurações (`/painel/configuracoes`) — aprovada
Abas em pill segmentada (Loja/Horários/Entrega) com salvamento por aba e erros listados. **Loja**: nome, WhatsApp só-dígitos, descrição, Pix, logo (tile + nota do bucket). **Horários**: 7 dias com switch abre/fecha, até 3 faixas `time` por dia com +/✕, validação fim>início e formato (espelha o trigger). **Entrega**: bairros com switch + taxa + remover/criar e aviso pickup-only quando 0 ativos; mínimo (sobre subtotal) e preparo mín/máx (alimenta `promised_at`). Tudo grava em `stores` com RLS no backend.

### 8.13 Admin (`/admin/lojas` → `/admin/lojas/[id]`) — aprovada
`/admin` redireciona p/ lista. **Lista**: stats (lojas, ativas, pedidos hoje), filtros Todas/Ativas/Inativas + busca, cards com status, dono, pedidos e "desde", chevron; **criar loja** com validação de slug `^[a-z0-9-]{3,40}$` (imutável) + senha provisória aleatória exibida **1 vez** com copiar. **Detalhe**: vitrine ↗, números (pedidos, faturamento, slug), nota de imutabilidade, toggle active com aviso 404/painel, reset de senha (mostra 1 vez, "copiar e ocultar"), **anonimizar LGPD** com linha rica (total, tempo, tipo, pagamento) e confirmação em 2 cliques. Tudo via service role + Auth Admin API no backend.
