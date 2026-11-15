# QA Report — Kero (SaaS de delivery)

**Data:** 14/11/2026 · **Ambiente:** `http://localhost:3000` (Next.js 16.4.2, dev/Turbopack) · **Banco:** Supabase (produção do projeto `cardapio-digital-kero-delivery`)
**Loja de teste:** `pizzariadokbc` — "Pizzaria do kabeça" (`5751a74b…1383`)
**Viewports:** mobile 390×844 · tablet 768×1024 · desktop 1440×900
**Metodologia:** navegação real via Playwright (Chromium), console + rede monitorados em todas as páginas, screenshots em `qa-screenshots/`. Scripts de auditoria em `qa/`.

> **Nota sobre credenciais:** a senha informada no briefing (`KeroAdmin2026!`) **não autentica** `pizzaria123@gmail.com` — a senha correta do lojista da loja de teste é `LojistaTest2026!`. `KeroAdmin2026!` é a senha do **operador da plataforma** (`admin@kero.app`), que foi usada para auditar `/admin`. Todos os testes abaixo usaram a loja de teste; nenhuma loja real foi alterada.

---

## 1. Resumo executivo

**Nota geral: 6,5 / 10**

O sistema é visualmente polido e a maior parte dos fluxos funciona (kanban com transições persistidas, cupom 80mm com largura exata, mapa Leaflet com tiles OSM e marcadores, isolamento entre lojas sólido, guards de rota íntegros). Porém a auditoria encontrou **4 defeitos de severidade Alta** que quebram fluxos de negócio reais, e um padrão repetido de **mensagens de erro internas expostas ao usuário final**.

**Principais riscos, em ordem:**

| # | Risco | Impacto |
|---|---|---|
| 1 | **Editar item da sacola é inútil** — o modal de edição abre atrás da própria sacola (`z-index` igual, sacola renderizada depois) | Cliente não consegue trocar adicionais/quantidade de um item já adicionado; o CTA "Salvar" é visualmente visível e **não clicável** |
| 2 | **CEP inexistente resolve para um endereço falso** — a BrasilAPI devolve HTTP 200 com uma rua inventada ("Avenida das Torres", Sarandi/PR) em vez de 404 | O pino do mapa cai a ~2.800 km da loja **sem aviso de erro**; o pedido é gravado com essas coordenadas → taxa de entrega e navegação do motoboy erradas |
| 3 | **Rota de motoboy obsoleta trava a operação** — rota `open` de 11/11 nunca fechada; o único motoboy aparece desabilitado no modal "Atribuir motoboy" e **não há caminho de UI para encerrar a rota** | A loja fica impedida de despachar qualquer entrega |
| 4 | **QR code do cupom 80mm quebrado** — API `chart.googleapis.com/chart?cht=qr` foi descontinuada e responde 404 | "Escaneie para acompanhar" não funciona — o cliente que tenta rastrear pelo cupom recebe uma imagem quebrada |

Além disso: **não existe botão de sair (logout)** em toda a área do painel, e os **filtros Entrega/Retirada do kanban** aplicam com ~3 s de atraso e sem qualquer feedback de carregamento.

**Nenhum defeito Crítico** (nada derruba o sistema ou corrompe dados em massa) e **nenhum vazamento de dados entre lojas** — o isolamento multi-tenant passou em todas as tentativas.

**Contagem:** 4 Alto · 13 Médio · 10 Baixo · 0 Crítico.

---

## 2. Rotas testadas

Descobertas pelas pastas do App Router (`app/`) e confirmadas pelos links do menu.

**Públicas:** `/` · `/privacidade` · `/login` · `/login/esqueci-senha` · `/motoboy/login` · `/motoboy` · `/{slug}` · `/{slug}/pedido/{token}` · `/rota-inexistente` (404) · `/loja-inexistente` (404) · `/pizzariadasol` (loja inativa → 404)

**Painel do lojista:** `/painel` · `/painel/pedidos` · `/painel/pedidos/{id}` · `/painel/pedidos/{id}/print` · `/painel/pdv` · `/painel/entregas` · `/painel/cardapio` · `/painel/clientes` · `/painel/configuracoes` · `/painel/whatsapp` · `/painel/financeiro`

**Operador da plataforma:** `/admin` · `/admin/lojas` · `/admin/lojas/{id}` · `/admin/configuracoes`

**API exercitadas:** `POST /api/quote` · `POST /api/orders` · `PATCH /api/orders/{id}/status` · `GET /api/orders/track/{token}` · `POST /api/geo/geocode` · `GET /api/geo/cep` · `GET /api/whatsapp/status` · `GET /api/whatsapp/chats` · `GET /api/admin/stores/{id}`

---

## 3. Tabela de problemas

| ID | Sev. | Área | Página/rota | Disp. | Passos para reproduzir | Esperado vs. Obtido | Arquivo/linha provável | Screenshot |
|---|---|---|---|---|---|---|---|---|
| **A-01** | Alto | Pública | `/{slug}` (sacola) | Todos | Adicionar item → abrir sacola → clicar **Editar** | Modal de edição abre **sobre** a sacola e o CTA "Salvar" funciona. → Modal abre **atrás** da sacola; CTA e ✕ inalcançáveis (elemento no ponto = `button.btn-finalizar-carrinho`) | `app/[slug]/storefront-client.tsx:301-401` vs `:453-526`; `app/[slug]/storefront.css:461-465` (`z-index: 20` nos dois) | `qa-screenshots/bug-editar-item-zindex.png` |
| **A-02** | Alto | Pública | `/{slug}` (checkout) | Todos | CEP `99999999` → "Buscar endereço no mapa" | Endereço não encontrado → aviso + sem pino. → API responde **200** com lat/lng de **Sarandi/PR**; pino no mapa sem aviso de erro | `lib/geocode.ts:150-175` (comentário assume 404 da BrasilAPI — é 200); `app/api/geo/geocode/route.ts:52-63` | `qa-screenshots/pub-checkout-cep-invalido-botao.png` |
| **A-03** | Alto | Admin | `/painel/entregas` | Desktop | Pedido de entrega em "PRONTAS" → "Atribuir motoboy" | Motoboy atribuível. → Único motoboy aparece **desabilitado** ("davi · em rota"); rota `open` de 11/11 sem botão para encerrá-la | `lib/painel.ts:513-518` (`courierOnRoute`); `app/painel/entregas/page.tsx:98-112`; `lib/painel-actions.ts:578-594` (`COURIER_EM_ROTA`), `:707-722` | `qa-screenshots/adm-entregas-modal-atribuir.png` |
| **A-04** | Alto | Admin | `/painel/pedidos/{id}/print` | Todos | Abrir cupom 80mm | QR code renderiza. → Imagem quebrada (404 de `chart.googleapis.com`) | `app/painel/pedidos/[id]/print/page.tsx:11-19` | `qa-screenshots/adm-cupom-80mm.png` |
| **M-01** | Médio | Pública | `/{slug}` (modal produto) | Todos | Abrir x-salada → grupo "Sabores" | Texto reflete a regra real (mín. 1, máx. 2). → "Escolha 2 opções." (mín. do banco é 1) | `app/[slug]/storefront-client.tsx:157-161` (`descricaoEscolha`) | `qa-screenshots/pub-produto-modal.png` |
| **M-02** | Médio | Pública | `/{slug}` (modal produto) | Todos | Grupo com máx. 2 e 3 opções: marcar A, B, depois C | Ao atingir o limite, a 3ª marcação não apaga as anteriores (ou avisa). → Só **C** fica marcado; A e B somem **em silêncio** | `app/[slug]/storefront-client.tsx:130-142` (`alternarEscolha`) | `qa-screenshots/bug-max-choices-troca.png` |
| **M-03** | Médio | Pública | `/{slug}` (sacola) | Todos | Esvaziar a sacola → "Finalizar pedido" | Botão desabilitado com carrinho vazio. → Habilitado; leva ao checkout → "Erro: itens_invalido" | `app/[slug]/storefront-client.tsx:513-522` (`disabled={!isOpen}`) | `qa-screenshots/pub-checkout-carrinho-vazio.png` |
| **M-04** | Médio | Pública | `/{slug}` (checkout) | Todos | Pedido abaixo do mínimo / telefone curto / troco inválido | Mensagem em português para o cliente. → Códigos crus: `MIN_ORDER:Faltam 10,00…`, `itens_invalido`, `telefone_invalido`, `troco_invalido` | `app/[slug]/checkout.tsx:129`, `:293`, `:300`, `:600-604` (`Erro: {erro}`) | `qa-screenshots/pub-checkout-cep-inexistente.png` |
| **M-05** | Médio | Pública | `/{slug}` (checkout) | Todos | Abrir checkout e tentar finalizar vazio | Feedback do que falta. → Botão desabilitado, **nenhuma mensagem**; nada acontece ao clicar | `app/[slug]/checkout.tsx:283-287` + `:654` | `qa-screenshots/pub-checkout-vazio.png` |
| **M-06** | Médio | Pública | `/{slug}` (checkout) | Todos | Digitar "69000-000" no CEP | Campo exibe `69000-000`. → Exibe `69000000` (o `\D` é removido, sem máscara) | `app/[slug]/checkout.tsx:521` | `qa-screenshots/pub-checkout-mapa.png` |
| **M-07** | Médio | Pública | `/{slug}` (modais) | Todos | Abrir produto / sacola → `Esc` | Modal fecha. → **`Esc` não fecha** o modal de produto nem o da sacola | `app/[slug]/storefront-client.tsx:301-401`, `:453-526` (sem listener de teclado) | `qa-screenshots/pub-produto-modal.png` |
| **M-08** | Médio | Admin | `/painel/pedidos` | Todos | Clicar "Entrega"/"Retirada" | Kanban filtra imediatamente com feedback. → Botão destaca na hora, dados só mudam **~3 s depois**, sem spinner/skeleton | `app/painel/pedidos/page.tsx:196-205` + efeito em `:48-55` | `qa-screenshots/adm-pedidos-desktop.png` |
| **M-09** | Médio | Admin | `/painel/cardapio`, `/painel/entregas`, `/painel/configuracoes` | Todos | Abrir "Novo Produto" / "Novo motoboy" / abas de Config | Cada campo com `<label>`/`aria-label`. → **Nenhum** campo tem label associado (`labels.length === 0`, sem `aria-label`); só há texto visual e `placeholder` | `app/painel/cardapio/page.tsx` (modal produto), `app/painel/entregas/page.tsx:225-232` (modal motoboy), `app/painel/configuracoes/page.tsx` | `qa-screenshots/adm-entregas-modal-motoboy.png` |
| **M-10** | Médio | Admin | `/painel`, `/painel/configuracoes` | Mobile | Abrir as duas telas em 390 px | Sem rolagem horizontal. → `scrollWidth` 459 e 597 (vs 390) — a barra de período e as abas de Config estouram a viewport | `components/ui/period-filter.tsx`; `app/painel/configuracoes/page.tsx:293` (`.cfg-subnav-item`) | `qa-screenshots/adm-hoje-mobile.png`, `qa-screenshots/adm-config-mobile.png` |
| **M-11** | Médio | Admin | `/painel/entregas` | Todos | Abrir a página | Realtime ativo (indicador "tempo real"). → Falha de WebSocket: `WebSocket is closed before the connection is established` → o painel cai no polling de 30 s | `lib/painel-live.ts` | — (console) |
| **M-12** | Médio | Admin | `/painel` (todas) | Todos | Procurar "Sair" | Botão de logout. → **Não existe** em nenhuma tela do painel; `signOut` só existe nos clientes de login | `app/painel/shell.tsx:159-171` (rodapé só tem o tema) | — |
| **M-13** | Médio | Admin | `/painel/entregas` | Todos | Ver o mapa | Mapa ou explicação do que falta. → Pedidos em "PRONTAS" **não** entram no mapa (só `status === "out"`), e o estado vazio diz "Nenhuma entrega no mapa agora" sem explicar | `lib/painel.ts:519`, `:529` (`mapPoints(outOrders)`) | `qa-screenshots/adm-entregas-mapa.png` |
| **B-01** | Baixo | Pública | `/{slug}` (rodapé) | Todos | Rolar até o rodapé | WhatsApp real da loja. → "WhatsApp: 0000000000" (placeholder), link `wa.me/550000000000` | dado da loja de teste (`stores.whatsapp`) | `qa-screenshots/pub-vitrine-mobile.png` |
| **B-02** | Baixo | Admin | `/painel/pedidos/{id}/print` | Todos | Imprimir cupom | Uma linha "Acompanhe". → **Duas** linhas "Acompanhe" com a URL (imprime 2× na bobina) | `app/painel/pedidos/[id]/print/page.tsx:115` e `:119` | `qa-screenshots/adm-cupom-80mm.png` |
| **B-03** | Baixo | Admin | `/painel/entregas` | Todos | Ver "Motoboys cadastrados" | "1 cadastrado · 1 ativo". → "1 cadastrado(s) · 1 ativo(s)" (plural manual) | `app/painel/entregas/page.tsx:163` | `qa-screenshots/adm-entregas-full.png` |
| **B-04** | Baixo | Admin | `/painel/entregas` | Todos | Ver lista de motoboys | Telefone mascarado. → `92991532662` cru, sem máscara | `app/painel/entregas/page.tsx:174` | `qa-screenshots/adm-entregas-full.png` |
| **B-05** | Baixo | Pública | `/{slug}/pedido/{token}` | Todos | Abrir acompanhamento | Rótulos padronizados. → "recebido" (minúsculo) vs. "Confirmado"/"Entregue" no painel | `app/[slug]/pedido.tsx:30-38` (`STATUS_LABEL`) | `qa-screenshots/pub-acompanhamento.png` |
| **B-06** | Baixo | Pública | `/{slug}` (banner cookies) | Mobile | Abrir a vitrine em 390 px | Alvos de toque ≥ 44 px e alinhados. → "Recusar" com **26 px** de altura, "Aceitar" com 44 px, desalinhados; o primário encosta na borda inferior | `app/[slug]/cookie-banner.tsx` | `qa-screenshots/mob-cookie-banner.png` |
| **B-07** | Baixo | Admin | `/painel/pedidos` | Desktop | Abrir o kanban em 1440 px | 5 colunas visíveis. → A 5ª coluna ("ENTREGUES") fica **cortada** (280 px × 5 + gaps > 1440) | `app/painel/pedidos/page.tsx:208-213` | `qa-screenshots/adm-pedidos-desktop.png` |
| **B-08** | Baixo | Admin | `/painel/financeiro` | Todos | Adicionar conta a pagar | Campo "Vencimento" com nome acessível. → `input[type=date][name=due]` **sem** label/`aria-label` | `app/painel/financeiro/page.tsx` | `qa-screenshots/adm-financeiro-full.png` |
| **B-09** | Baixo | Admin | `/painel/pedidos/{id}/print` | Todos | Imprimir cupom | WhatsApp da loja no cupom. → Imprime `0000000000` | dado da loja de teste | `qa-screenshots/adm-cupom-80mm.png` |
| **B-10** | Baixo | Admin | `/painel/pedidos/{id}/print` | Todos | Clicar "📄 2ª Via" | 2ª via marcada como cópia. → Abre `?via=2`, mas o parâmetro **não é lido** em lugar nenhum: o conteúdo é idêntico e não traz nenhuma marcação de "2ª via" | `app/painel/pedidos/[id]/print/page.tsx:76-80` | `qa-screenshots/adm-cupom-80mm.png` |

---

## 4. Detalhamento dos achados de maior severidade

### A-01 · Editar item da sacola não funciona (z-index)

Reprodução: `/pizzariadokbc` → adicionar "x-salada" → "Ver sacola" → **Editar**.

O modal de produto (`role="dialog"`, `aria-label="x-salada"`) e a sacola (`aria-label="Sacola"`) são **dois elementos `.sheet-overlay` irmãos**, ambos com `z-index: 20` (`app/[slug]/storefront.css:461-465`). Como a sacola é renderizada **depois** no DOM (`storefront-client.tsx:453` vs `:301`), ela pinta por cima e intercepta os ponteiros:

```json
{ "ctaDisabled": false,
  "elementAtCta": "BUTTON.btn-finalizar-carrinho",
  "overlays": [ { "z": "20", "label": "x-salada" }, { "z": "20", "label": "Sacola" } ] }
```

O botão ✕ do modal também não responde (o overlay da sacola cobre a viewport inteira). O usuário só escapa clicando no fundo (o que fecha a sacola). Workaround: remover o item e adicionar de novo.

**Correção sugerida:** fechar a sacola ao abrir a edição (`setCarrinhoAberto(false)` em `abrirEdicao`, `storefront-client.tsx:119-128`) **ou** dar `z-index` crescente ao overlay mais recente (ex.: `z-index: 20 + nº de overlays abertos`).

### A-02 · CEP inexistente resolve para endereço falso

```bash
curl -sX POST localhost:3000/api/geo/geocode -H 'content-type: application/json' -d '{"cep":"99999999"}'
# → 200 {"lat":-23.4621723,"lng":-51.8969792,"origem":"endereco"}   # Sarandi/PR
curl -s https://brasilapi.com.br/api/cep/v2/99999999
# → 200 {"cep":"99999999","city":"Sarandi","street":"Avenida das Torres",...}
```

O comentário em `lib/geocode.ts:160-168` assume que "se o CEP for inválido, a BrasilAPI retorna 404 (já tratado pelo `if (res.ok)`)" — **a premissa é falsa**: a API devolve 200 com uma rua sintetizada. Resultado: o `origem` volta como `"endereco"` (não `"cep"`), então nem o aviso "Achamos só a região do CEP. Arraste o pino até a sua porta." aparece. O pedido é gravado com essas coordenadas.

**Correção sugerida:** validar o CEP antes de usar o retorno — comparar o `cep` devolvido com o consultado (`dadosCep.cep !== cepDigits` ⇒ tratar como inexistente) e/ou exigir que `street`/`city` venham preenchidos; jamais aceitar coordenadas sem origem verificável.

### A-03 · Rota obsoleta impede atribuir motoboys

Estado encontrado em `routes`: uma rota `open` de **11/11/2026** cujo único `route_stop` aponta para o pedido `272d6fbe…`, que já está `delivered` (`route_stops.delivered_at` continua `null`).

Consequência: `courierOnRoute()` (`lib/painel.ts:513-518`) marca o motoboy como em rota → no modal "Atribuir motoboy" o único motoboy aparece **desabilitado** (`opacity-40`, "davi · em rota"), e `assign_courier` recusaria com `COURIER_EM_ROTA`. O botão "Encerrar rota" (`app/painel/entregas/page.tsx:107-111`) só é renderizado para cards com `status === "out"` — e o pedido da rota está `delivered`, então **não há botão em lugar nenhum** para encerrá-la. O lojista fica sem poder despachar.

**Correção sugerida:** encerrar a rota automaticamente quando o último stop é entregue (`delivered_at`), e expor um "Encerrar rota" também no card concluído / na lista de motoboys.

### A-04 · QR code do cupom quebrado

`app/painel/pedidos/[id]/print/page.tsx:11-19` gera o QR via `https://chart.googleapis.com/chart?cht=qr&…`. Esse endpoint foi **descontinuado em 2019** e responde `404` com HTML. O `<img>` exibe o ícone de imagem quebrada + o texto alternativo "QR code do pedido" no meio da bobina (visível no screenshot).

**Correção sugerida:** gerar o QR no servidor (ex.: `qrcode`) ou usar um serviço ativo; enquanto isso, esconder a imagem e manter só a URL.

---

## 5. O que foi testado e passou

**Segurança / isolamento**
- Todas as rotas de `/painel/*`, `/admin/*` e `/motoboy` **redirecionam para `/login`** sem sessão (13 rotas protegidas verificadas: 9 de `/painel`, 3 de `/admin`, 1 de `/motoboy`; mais `/login`, `/login/esqueci-senha`, `/motoboy/login`, `/`, `/privacidade` e 3 rotas 404).
- Pedido de **outra loja** (`/painel/pedidos/116062ee…`) → **404**; cupom de outra loja → **404**; `?store_id=` na URL é **ignorado**; `GET /api/admin/stores/{id}` como lojista → **405**. **Nenhum dado vazou.**
- Limpar os cookies → `/painel` volta para `/login` (sessão expirada ok).
- Login com senha errada → "E-mail ou senha inválidos." (sem vazar qual campo falhou); e-mail inexistente na recuperação → mesma mensagem neutra (sem enumeração de usuário).
- Recuperação de senha chama o endpoint do Supabase e confirma "E-mail de recuperação enviado!".

**Lojista — pedido e operação**
- Transições de status no kanban: `novo → confirmado → em preparo → pronto → entregue` otimistas na UI **e persistidas no banco** (confirmado via `orders.status` e `order_events`).
- Transições inválidas são **recusadas pelo banco** (HTTP 400 `INVALID_TRANSITION`) — ex.: `preparing → out` em pedido de retirada.
- Filtro por tipo (Entrega/Retirada/Todos) **aplica corretamente** no servidor (`getKanban`, `lib/painel.ts:311`) — confirmado no banco.
- Dashboard coerente: 2 pedidos válidos = R$ 60,00 = ticket médio R$ 30,00, 100% retirada, taxa de cancelamento 0% — todos batem com o banco.
- Detalhe do pedido: cliente, telefone mascarado, itens (snapshot com adicionais), subtotal/taxa/total, linha do tempo e link "Chamar no WhatsApp".
- Cupom 80mm: largura renderizada **302 px = 80 mm exatos**, `@page { size: 80mm auto }`, botões Voltar / Imprimir / 2ª Via.

**Lojista — mapa e entregas**
- Mapa (Leaflet) renderiza com tiles do OpenStreetMap (14 tiles, 47 requisições), marcadores da loja e do pedido e a etiqueta "📍 6,7 km da loja" no card.
- Estados vazios claros: "Nenhuma entrega no mapa agora", "coluna zerada ✓", "Nenhum motoboy cadastrado ainda".
- Cadastro de motoboy: modal com Nome, Telefone, E-mail, Senha (mín. 8 caracteres).
- Painel Financeiro: faturamento R$ 240,00 / despesas R$ 0,00 / líquido R$ 240,00, metas (dia 6%, semana 3%, mês 1%), mais vendidos, "abra o caixa para começar o dia", contas a pagar vazias com estado próprio.

**Lojista — cardápio**
- Abas Categorias / Produtos / Complementos / Combos funcionam; contadores corretos (2/2/2/0).
- **Criar categoria** pelo painel funciona e persiste (verificado no banco e removido ao final).
- Validação do produto no formulário: "Erro: Nome ≥2 letras e preço no formato 49,90." (placeholder de preço `49,90` — vírgula decimal, pt-BR).
- **Upload de imagem** funciona (input `type=file` + preview por blob, sem erro de rede).
- Complementos: grupo "Sabores" listado com "obrigatório · máx 2 · mín 1 · soma" e seus adicionais.

**Público — vitrine e carrinho**
- Moeda em pt-BR em todo lugar: "R$ 10,00", "R$ 60,00", "R$ 30,00" (nunca `10.0` nem `1000`).
- **Matemática do carrinho confere**: 3× R$ 10,00 = R$ 30,00 → +1 = R$ 40,00 → −1 = R$ 30,00; "R$ 10,00 cada"; total do modal = preço × qtd.
- Busca: filtra por nome/categoria e tem estado vazio próprio ("Nenhum produto encontrado para 'zzzznaoexiste'.").
- Modal de produto: grupo obrigatório **bloqueia** o CTA até a escolha mínima (comportamento correto), foto, descrição, stepper, observações.
- Pedido mínimo da loja (R$ 20,00) é respeitado pelo servidor (`422 MIN_ORDER`).
- **Geolocalização negada** → "Permissão de GPS negada" (feedback claro).
- Duplo clique em "Finalizar pedido" → **um único pedido** criado (guard `carregando` funciona).
- Fluxo completo de retirada: pedido criado (201) → redireciona para `/pedido/{token}` → página de acompanhamento com timeline, total e "Voltar ao cardápio".
- Acompanhamento público: telefone mascarado (`••••••62`), bairro, distância ("320 m"), itens e total; token inválido → 404 com mensagem.
- Cookie banner: Aceitar/Recusar funcionam e persistem (`lgpd-consentimento=recusado` no localStorage).
- Responsivo público: sem overflow horizontal em 390/768/1440; nenhum alvo de toque < 32 px no checkout mobile; scroll funciona.

**Operador da plataforma (`/admin`)**
- Dashboard com MRR (R$ 114,00), adesão no mês, lojas ativas/total, churn, ativação 7 d, CAC, coortes por mês e segmentos.
- `/admin/lojas`: 3 lojas, filtro ativas/inativas, "Exportar CSV", "Redefinir senha", "Marcar adesão paga", "Excluir loja" com aviso de irreversibilidade.
- `/admin/lojas/{id}`: dados da loja, plano, pedidos do dia, faturamento, slug imutável, reset de senha, exclusão.
- Loja inativa marcada como "inativa → 404 público" (correto).

---

## 6. O que **não** consegui testar (e por quê)

| Item | Motivo |
|---|---|
| **WhatsApp — lista de chats, abrir conversa, enviar mensagem, rolagem** | O serviço WAHA não está no ar neste ambiente: `GET /api/whatsapp/chats` → **502 `WAHA_ERROR`** e a tela mostra "Desconectado / A conexão falhou. Tente conectar de novo." Só o estado de desconectado foi validado. |
| **Configuração de impressora / vias de impressão** | **A funcionalidade não existe.** Não há aba, campo ou coluna "impressora"/"via" em `/painel/configuracoes` (abas: Loja, Horários, Entrega, Salão, Rastreamento, Conta) nem em `supabase/migrations`. |
| **Configuração de endereço/localização da loja** | A aba "Loja" tem Nome, WhatsApp, Descrição, Chave Pix, Logo, letreiro e capa — **não há campo de endereço/coordenadas** (o ponto fixo da loja é gravado só via service role). |
| **Upload de imagem salvo no Storage** | O seletor de arquivo e o preview funcionam; não confirmei o objeto final no bucket (o upload persiste no `Salvar`, que não foi concluído para não deixar lixo). |
| **Recuperação de senha ponta a ponta** | O e-mail real não chega neste ambiente; validado apenas o request ao Supabase e a mensagem de confirmação. |
| **Pagamento real** | Por instrução do briefing — nenhum pagamento foi disparado (só Pix/Dinheiro/Maquininha como *seleção*, sem cobrança). |
| **PWA do motoboy (`/motoboy` além do login)** | O login de motoboy exige credencial de courier que não foi disponibilizada; a rota protege corretamente (redireciona para `/motoboy/login`). |
| **Medição de performance real** | O ambiente é `next dev` (Turbopack): o tempo de compilação da rota domina as medições (chegou a >2 min na primeira compilação de `/print`). Os números de tempo da auditoria **não** representam produção. Só reporto como sinal: o primeiro carregamento de cada rotavariou de 1,1 s a 9,4 s no dev. |
| **Múltiplos(store) com dados realistas** | A loja de teste tem 2 produtos, 2 categorias, 3 bairros e 1 motoboy. Casos como "loja sem motoboy", "loja sem chave Pix" e "loja com 100 pedidos" foram simulados por estado (filtros, colunas vazias), não por volume real. |

---

## 7. Recomendações priorizadas

1. **Corrigir o z-index / fechar a sacola ao editar** (A-01) — 1 linha, destrava um fluxo de cliente inteiro.
2. **Validar o CEP contra o retorno da BrasilAPI** (A-02) — evita pedido com endereço e taxa errados.
3. **Fechar rotas automaticamente ao concluir a última parada + expor "Encerrar rota"** (A-03) — destrava a operação de entrega.
4. **Substituir o gerador de QR do cupom** (A-04) — ou remover o QR e manter a URL.
5. **Mapear códigos de erro → mensagens em português** (M-04) — `MIN_ORDER`, `itens_invalido`, `telefone_invalido`, `troco_invalido`.
6. **Fechar a sacola quando o carrinho estiver vazio** (M-03) e **explicar por que o botão está desabilitado** (M-05).
7. **Dar feedback de carregamento ao filtro do kanban** (M-08) e revisar o `descricaoEscolha` para respeitar `min_choices` (M-01).
8. **Associar `<label>`/aria-label a todos os campos do painel** (M-09, B-08) — assim que um form do painel tem 10+ campos sem nome acessível.
9. **Adicionar logout ao painel** (M-12) e corrigir o overflow horizontal no mobile (M-10).

---

## 8. Rastreabilidade

- Screenshots: `qa-screenshots/` (141 arquivos; os citados na tabela estão com o prefixo indicado).
- Scripts de auditoria: `qa/run*.mjs` (harness em `qa/lib.mjs`).
- Saídas brutas: `qa/out/*.txt` e `qa/out/*.json`.
- **Dados alterados na loja de teste** (somente `pizzariadokbc`): criados os pedidos de QA `a673aec4…`, `848d35e6…`, `97650178…`, `36195c3a…` e a categoria temporária "QA Categoria Teste" + um grupo de adicionais de teste — **todos removidos ao final** (exceto os pedidos, que são o registro da operação de teste). Nenhuma loja real foi tocada; a loja inativa `pizzariadasol` e a loja `loja-qa-hermes` só foram **lidas** (teste de isolamento).
