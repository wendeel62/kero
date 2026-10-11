# Plano — Design do Painel idêntico ao cardapio-digital (SÓ visual)

> Contrato anti-alucinação: só o que está neste documento pode ser mudado.
> Cada item diz o arquivo exato, o valor exato e o que NÃO fazer.
> **Regra zero:** nenhuma lib nova. Nenhuma feature nova. Nenhuma função nova.
> Se algo não está listado aqui, NÃO toque.

---

## 0. Contexto e diagnóstico (pra não repetir erro)

- O design system de **cores/tipografia/espaçamento já está 100% no kero**:
  `app/_design/admin.css` é **byte-a-byte idêntico** a
  `cardapio-digital/apps/admin/src/styles.css` (3565 linhas, `diff` vazio).
  **NÃO crie/edite `admin.css`** — ele já é a fonte. Só CONSUMA as classes dele.
- O problema atual: o painel **não usa o DS**. Ele reimplementa o visual em
  Tailwind com cores fixas. Contagem de cores hardcoded por arquivo
  (alvo da limpeza — item 7):

  | arquivo | cores hardcoded |
  |---|---|
  | `app/painel/shell.tsx` | 16 |
  | `app/painel/page.tsx` | 37 |
  | `app/painel/pedidos/page.tsx` | 58 |
  | `app/painel/pedidos/[id]/page.tsx` | 45 |
  | `app/painel/cardapio/page.tsx` | 43 |
  | `app/painel/cardapio/produtos/[id]/page.tsx` | 28 |
  | `app/painel/configuracoes/page.tsx` | 58 |

- Dark mode: os tokens `data-theme='dark'` já existem mas **nenhum componente
  ativa** — o botão de tema (item 4) é o que liga isso.

---

## 1. Regras transversais (valem pra TODA mudança)

### 1.1 Mapeamento de cor Tailwind → token (a única tradução permitida)

| Tailwind (proibido a partir de agora) | Token do DS (usar) |
|---|---|
| `text-stone-900` / `bg-stone-900` / `text-stone-950` | `var(--text)` |
| `text-stone-500/400/300` | `var(--muted)` |
| `bg-white` / `bg-white/80` (card) | `var(--surface)` |
| `border-stone-200/300` | `var(--border)` |
| `bg-stone-100` / `bg-white/5` / `bg-white/10` | `var(--pill-bg)` |
| `text-stone-100/200` (sobre escuro) | `var(--pill-ink)` |
| `bg-emerald-*` / `text-emerald-*` | `var(--green)` / `var(--green-soft)` |
| `bg-red-*` / `text-red-*` (estado loja) | `var(--red)` / `var(--red-soft)` |
| `bg-amber-*` / `text-amber-*` | `var(--amber)` / `var(--amber-soft)` |
| `bg-blue-*` / `text-blue-*` | `var(--info)` / `var(--info-soft)` |
| `bg-red-500/600` (marca Kero) | `#dc2626` fica pro badge cancelado; marca usa `var(--red)` |
| `bg-gradient-to-br from-red-600 to-orange-500` (logo K) | manter o gradiente do kero (é identidade, NÃO é do DS) |

**Sempre** a cor semântica certa: badge/estado usa par `-soft` (fundo) +
`-ink` (texto). Nunca fundo cheio em estado.

### 1.2 Tipografia (especificação exata do cardápio)

- **Só Inter.** Remover Sora inteiramente:
  - `app/layout.tsx:14` → link só `family=Inter:wght@400;500;600;700;800`
  - `app/globals.css` → remover a classe `.font-display` (que aponta pra Sora)
  - Trocar todo `font-display` usado no painel por `font-[800]` (peso) —
    `--font-display` e `--font-body` do DS são **ambos Inter**.
- Tamanhos/pesos da spec (usar como estão, sem "melhorar"):
  - H1 (topbar): **21px / 800 / letter-spacing -0.02em**
  - label KPI: **11.5px / 600 / uppercase / muted / letter-spacing .04em**
  - valor KPI: **24px / 800 / tabular-nums** (o CSS do StatCard já é 1.5rem=24px)
  - subtítulo topbar: **12px / muted**
  - badge/pill: **11.5px / 700 / radius 999px**
  - botão: **0.875rem / 600 / min-height 36px** (`.btn` já resolve)

### 1.3 Espaçamento / raio

- padding conteúdo: **24px 28px** (`.admin-content` já existe no CSS) — no
  painel, trocar `p-4 sm:p-8 max-w-6xl` por container do DS.
- grid gap: **18px**; KPI grid: o CSS do DS (`.kpi-grid`) já cuida dos
  breakpoints 5→3→2 colunas. Usar `className="kpi-grid"`.
- raio: card **14px** (`--radius-card`), botão/input **10px**, pill **999px**.
- **Não invente paddings/radius próprios** — as classes do DS já têm.

### 1.4 Animações

- Hover de card: **já está** em `.card:hover` do DS (translateY(-4px) +
  shadow). Só consumir `.card`. **NÃO** adicionar framer-motion.
- Manter as animações próprias do kero que já existem e não conflitam
  (`anim-rise`, `anim-pop`, `live-dot` etc. em `app/globals.css`) — elas são
  do kero e não ferem a paridade visual.

---

## 2. Mudanças arquivo por arquivo

### 2.1 `app/layout.tsx` (raiz)
- **Fazer:** trocar o `<link>` de fontes para só Inter
  (`family=Inter:wght@400;500;600;700;800`), remover Sora.
- **Não fazer:** nada mais. Não tocar em `globals.css` de import.

### 2.2 `app/globals.css`
- **Fazer:** remover a classe `.font-display { font-family: Sora... }`.
- **Não fazer:** não remover `@import "./_design/tokens.css"` nem
  `@import "./_design/admin.css"`. Não remover as animações `.anim-*`,
  `.texture-*`, `.dish-card`, `.live-dot` do kero.

### 2.3 `app/painel/_design.css` (28 linhas, override com `!important`)
- **Fazer:** REVISAR — hoje força `bg-white/80 → --surface` via `!important`.
  Depois da limpeza (item 2.7+) esse override vira desnecessário. **Apagar o
  arquivo** só se, ao final, nenhuma classe depender dele.
- **Não fazer:** não deixar `!important` brigando com o DS novo.

### 2.4 `app/painel/shell.tsx` — reescrever com o DS (arquivo central)
- **Fazer:** portar o comportamento visual de
  `cardapio-digital/apps/admin/src/components/layout/Sidebar.tsx` + `.css`,
  adaptado ao Next/router do kero:
  - largura **56px → 220px** no hover (delay 120ms), `transition: width .2s
    cubic-bezier(.4,0,.2,1)`; mobile: drawer que abre com overlay + fecha no
    **Escape**.
  - itens com classe `.sb-link`, ativo `.sb-link--active` (fundo
    `--accent-soft`, texto `--text`, barra lateral 3px `--accent`).
  - ícone **18px, stroke 1.7** (hoje 20px/1.8).
  - **agrupar nav** com rótulos "Operação" / "Gestão" (`.sb-section-label`),
    no mesmo espírito do cardápio:
    - Operação: Hoje, Pedidos
    - Gestão: Cardápio, Config
  - manter o **badge de contagem** de pedidos (função existente do kero) com
    classe `.sb-badge`.
  - **footer** (`.sb-footer`): avatar/iniciais do usuário + papel, e
    **botão de tema** (`.sb-theme-btn`) que alterna `data-theme` no
    `<html>` e persiste em `localStorage` (chave `kero-theme`).
  - manter a topbar mobile do kero (função), só trocar as classes pro DS
    (`.sb`/pill conforme 2.1).
- **Não fazer:**
  - não trazer login/logout do cardápio (o kero usa Supabase/auth próprio —
    NÃO inventar fluxo de auth).
  - não mudar a navegação/hrefs — os 4 itens atuais ficam.
  - não usar `bg-white text-stone-900` no ativo — isso é exatamente o que sai.

### 2.5 `app/painel/page.tsx` (Hoje) — limpar classes
- **Fazer:**
  - remover a "luz ambiente" (`absolute -top-24 ... blur-3xl`) — não existe no
    cardápio.
  - título: usar o padrão topbar (21/800) em vez do hero 28px + `font-display`
    + gradiente/textura de fundo (`.texture-grain`/hero visual não é do admin).
  - KPIs: usar `className="kpi-grid"` + `StatCard` (ver 2.8).
  - toggle loja: trocar `bg-red-600`/`bg-emerald-500` por
    `var(--red)`/`var(--green)` via tokens (comportamento igual).
  - sparkline: manter (é visual do kero), só trocar as cores fixas
    (`#78716c`, `#16a34a`, `#2563eb`) pelos tokens
    (`--muted`, `--green`, `--info`).
- **Não fazer:** não remover `useCountUp`, não mexer na lógica `toggle()`,
  não remover o spark.

### 2.6 `app/painel/pedidos/page.tsx` + `[id]/page.tsx`
- **Fazer:** trocar todas as cores hardcoded (58+45) pela tabela 1.1;
  usar `.card`, `.badge`/`StatusBadge` (2.9), `.btn` (2.8), pills/empty states
  do DS.
- **Não fazer:** não mexer no polling (`setInterval`), na lógica de status, no
  cupom/print (`print/page.tsx` fica como está — é página limpa de propósito).

### 2.7 `app/painel/cardapio/page.tsx` + `produtos/[id]/page.tsx`
- **Fazer:** mesma limpeza de cores (43+28) → tabela 1.1; cards e botões via
  DS; imagens/uploaders mantidos (função).
- **Não fazer:** não mudar fluxo de produto/imagem/preço.

### 2.8 `app/painel/configuracoes/page.tsx`
- **Fazer:** mesma limpeza (58) → tabela 1.1; inputs com raio 10px
  (`--radius-button`), botões `.btn`, seções `.card`.
- **Não fazer:** não mudar o que salva/nem os campos.

### 2.9 `components/ui/` — ajustes pontuais
- `StatCard.tsx`: adicionar `deltaTone?: 'up'|'down'|'warn'|'flat'` e aplicar
  `stat-delta--{tone}` (o CSS já existe). Hoje `sub` é sempre mesma cor.
- `status-badge.tsx`: trocar as classes Tailwind
  (`bg-red-50 text-red-700 border-red-200`) pelo par DS
  (`--status-*-soft` + `--status-*`) via `badge badge--{info|success|
  warning|error|primary}`. **Manter os 7 estados e a lógica `new`** — só muda a
  cor. Manter o dot em `new`.
- `Card.tsx`: já funciona (usa `.card`); só garantir que o hover do CSS valha
  (não precisa mexer, é confirmação).
- **Não fazer:** não criar componentes novos além disso.

### 2.10 Fora do escopo (NÃO tocar)
`app/admin/*` (área operador), `app/[slug]/*` (vitrine), `app/login`,
`app/api`, `lib/*`, `supabase/*`, testes. **Nenhuma lib nova** (sem
framer-motion, sem lucide, sem mapa).

---

## 3. Definição de "pronto"

- [ ] Nenhuma cor `stone-*|red-*|emerald-*|amber-*|blue-*|zinc-*|rose-*
      |orange-*` restante em `app/painel` e `components/ui` (salvo o gradiente
      do logo K e o badge `#dc2626` de marca, se aplicável).
- [ ] Sidebar 56→220px com grupos, ativo accent-soft, footer com usuário +
      botão de tema que liga `data-theme='dark'` (e persiste).
- [ ] Só Inter carregada; `.font-display` removida.
- [ ] H1 21/800, KPI label 11.5px uppercase, valor 24/800.
- [ ] `npm run lint`, `npm run build`, `npm test` passando.
- [ ] Comparação lado a lado (screenshot) `/painel` vs admin do cardápio:
      mesma paleta, mesma tipografia, mesma sidebar.

---

## 4. Riscos / cuidados

- `admin.css` é **cópia** (não dependência): futuras mudanças no DS precisam
  espelhar nos dois repos. Hoje não mexe nele.
- A troca de classe não muda lógica, mas o diff cobre todas as telas do
  painel — revisar `npm test` após cada arquivo grande.
- Dark mode só fica correto se **toda** cor hardcoded sair; se sobrar uma
  `bg-white` ela fura o tema escuro. Por isso o checklist exige zero.
