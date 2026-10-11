# Design System v2 – Plano de migração do cardapio-digital/admin para kero

## Objetivo
Copiar exatamente o design do painel `/admin` do projeto `cardapio-digital` para o projeto `kero`, mantendo apenas a camada visual: tokens, tipografia, cores, espaçamentos, componentes base, animações e estados de hover/focus. Sem lógica de negócio.

## Fonte
` /home/david/cardapio-digital/apps/admin/src/styles.css`
` /home/david/cardapio-digital/apps/admin/src/pages/Dashboard.tsx`
` /home/david/cardapio-digital/apps/admin/index.html` – import Inter

## Princípios de extração
* **Ponytail lazy:** não reescrever o que já existe. Reaproveitar `--bg`, `--surface`, `--accent`, etc.
* Corrigir erros encontrados na fonte para não repetir no kero.
* Manter dual-theme light/dark via `data-theme`.

## 1. Tokens

### Cores – tema claro
```css
:root, :root[data-theme='light'] {
  --bg: #f6f6f7;
  --surface: #ffffff;
  --surface-2: #fbfbfc;
  --border: #e7e7ea;
  --text: #16161a;
  --muted: #70707a;
  --accent: #FFCE12;
  --accent-ink: #1a1a1a;
  --accent-soft: #fff6c9;
  --green: #15803d;
  --green-soft: #dcfce7;
  --amber: #b45309;
  --amber-soft: #fef3c7;
  --red: #dc2626;
  --red-soft: #fee2e2;
  --pill-bg: #efeff1;
  --pill-ink: #55555e;
  --pill-active-bg: #17171a;
  --pill-active-ink: #ffffff;
  --shadow: 0 1px 2px rgba(16,16,20,0.05);
  --shadow-card-hover: 0 8px 24px rgba(16,16,20,0.12);
}
```

### Cores – tema escuro
```css
:root[data-theme='dark'] {
  --bg: #0e0e10;
  --surface: #211D1A;
  --surface-2: #2a2522;
  --border: #28282d;
  --text: #f4f4f5;
  --muted: #9b9ba4;
  --accent: #FFCE12;
  --accent-ink: #1a1a1a;
  --accent-soft: #332c0d;
  --green: #4ade80;
  --green-soft: #0c2e1c;
  --amber: #fbbf24;
  --amber-soft: #33260a;
  --red: #f87171;
  --red-soft: #3a1212;
}
```

### Tipografia e raio
```css
--font-display: 'Inter', sans-serif;
--font-body: 'Inter', sans-serif;
--radius-card: 14px;
--radius-button: 10px;
--radius-pill: 999px;
--shadow-card: var(--shadow);
```

### Motion tokens
```css
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 350ms;
--easing-standard: cubic-bezier(0.16,1,0.3,1);
--easing-emphasized: cubic-bezier(0.2,0,0,1);
--easing-spring: cubic-bezier(0.34,1.56,0.64,1);
```

## 2. Base global para kero
Adicionar ao `app/globals.css` após o Tailwind:

* Import Inter via next/font ou link
* `html { font-family: var(--font-body); }`
* `body { background: var(--bg); color: var(--text); }`
* Definir variáveis acima e alias `--color-*`.

## 3. Componentes essenciais copiados

### Card
* `border-radius: var(--radius-card); background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow);`
* Hover: `transform: translateY(-4px); box-shadow: var(--shadow-card-hover);` + barra superior 3px com gradiente do acento.
* Spotlight: pseudo-elemento radial que segue `--mx/--my` do pointer.

### KPI / StatCard
* Layout flex vertical, label em cima, valor grande, delta embaixo.
* Grid 5 colunas no dashboard.

### Pills
* `.period-pill` com `background: var(--pill-bg); color: var(--pill-ink);`
* Ativo: `background: var(--pill-active-bg); color: var(--pill-active-ink);`

### Alert banner
* `background: var(--red-soft); color: var(--red); border-radius: 10px;`

### Donut e progresso
* Animação de preenchimento 1.2s com easing.

## 4. Animações a migrar
* Framer Motion stagger `staggerChildren: 0.1s`
* KPI warn pulse `kpi-warn-pulse 2.2s infinite`
* Spotlight em `.dash-card:hover::before` opacity 0→1
* `meta-fill` width transition 1s
* Live dot pulse

## 5. Correções aplicadas na fonte
* Sidebar active remove border duplicada – manter `border: none`
* Evitar `margin-top:auto` no delta para não quebrar grid – usar `flex:1` no valor
* `color-mix` usado apenas onde suporte existe; fallback para browsers antigos
* `ponytail:` comentário indicando O(n²) scans evitados

## 6. Passo a passo de implementação no kero
1. Criar `app/_design/tokens.css` com blocos acima.
2. Importar em `app/globals.css`.
3. Substituir cores atuais do kero por variáveis do design system.
4. Copiar classes `.card`, `.kpi-card`, `.dash-card`, `.period-pill`, `.alert-banner`.
5. Adicionar fonte Inter via `next/font/google`.
6. Criar componentes React puros `Card`, `StatCard`, `Pill` sem hooks.
7. Testar tema claro/escuro via `data-theme` no `<html>`.

## 7. Mapeamento de páginas entre projetos

### Páginas em comum – mesmo conteúdo, design a atualizar agora
Essas páginas já existem no kero e devem receber o design do `cardapio-digital/admin`:

* **Dashboard / Painel Home**
  * kero: `app/painel/page.tsx`
  * admin fonte: `apps/admin/src/pages/Dashboard.tsx`
  * Padrões a aplicar: KPI grid 5 col, cards com spotlight/hover lift, pílulas de período, alert banner, meta donut, mini-map, listas com badges

* **Pedidos / Kanban**
  * kero: `app/painel/pedidos/page.tsx`
  * admin fonte: `apps/admin/src/pages/Pedidos.tsx`
  * Padrões a aplicar: colunas Kanban, `StatusBadge`, cards de pedido com hover, barra de ação, filtros pílula, badge de contagem

* **Cardápio**
  * kero: `app/painel/cardapio/page.tsx`
  * admin fonte: `apps/admin/src/pages/Cardapio.tsx`
  * Padrões a aplicar: grid de categorias, drag handle, toggle ativo, cards com raio 14px, inputs com borda `var(--border)`

* **Configurações**
  * kero: `app/painel/configuracoes/page.tsx`
  * admin fonte: `apps/admin/src/pages/Configuracoes.tsx`
  * Padrões a aplicar: seções em `card`, tabs, formulário com tokens, upload de imagem, estados de sucesso/erro

### Páginas do admin sem equivalente ainda no kero – registrar para futura implementação
* **PDV** – `apps/admin/src/pages/PDV.tsx` → não existe no kero
* **Entregas** – `apps/admin/src/pages/Entregas.tsx` → não existe no kero
* **Financeiro** – `apps/admin/src/pages/Financeiro.tsx` → não existe no kero
* **Clientes** – `apps/admin/src/pages/Clientes.tsx` → não existe no kero

Recomendação: criar placeholders em `app/painel/pdv`, `app/painel/entregas`, `app/painel/financeiro` e `app/painel/clientes` quando a feature for priorizada, já usando os mesmos tokens e componentes base definidos acima.

Todas as páginas compartilham os mesmos tokens, tipografia Inter, raio 14px, sombras, estados hover/focus e animações.

## 8. Arquivos de referência
* Fonte: `apps/admin/src/styles.css` linhas 10-90, 624-758, 2830-2862
* Dashboard layout: `apps/admin/src/pages/Dashboard.tsx` linhas 217-433
* Font import: `apps/admin/index.html` linhas 18

Documento gerado em 2026-10-10. Atualizar conforme novas variantes forem surgindo.
