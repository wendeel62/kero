# Kero — Análise de Gaps da SPEC v2 (pontos onde a IA vai inventar)

> **SUPERSEDED** pela SPEC v3 + emendas §14 (v3.1, out/2026). Documento histórico — não executar nada a partir daqui. Os gaps remanescentes foram resolvidos: B8 (fuso) → v3.1 #1; B14 (store_id nulo) → v3.1 #15; A11 (cancellation_reason) → v3.1 #14; A10 (bairro desativado após carrinho) → coberto pelo recálculo server-side do RPC `create_order` (falha no checkout, §9).

**Objetivo:** listar tudo que a SPEC v2 referencia mas não define, ou define de forma ambígua.
Critério: se dois desenvolvedores-IA implementarem a SPEC de forma independente e produzirem resultados diferentes, é gap.

Severidade:
- **A** = bloqueia implementação correta (IA vai inventar regra de negócio)
- **B** = IA vai inventar detalhe técnico (funciona, mas diverge entre implementações)
- **C** = cosmético/convenção

---

## A — Gaps críticos (regra de negócio indefinida)

### A1. Tabela `profiles` nunca é definida
A seção 6 inteira depende dela (`profiles.store_id`, `profiles.role='admin'`, helper `auth_store_id()`), mas a seção 5 (Modelo de Dados) não cria a tabela.
Falta: colunas, constraints, RLS da própria tabela, e **quem/como cria a linha** (trigger em `auth.users`? service role no admin?).

### A2. `create_order` — a transação do checkout não existe
Seção 7 passo (h) diz "grava orders + order_items + order_events numa transação". Mas supabase-js não faz transação multi-statement via PostgREST — isso exige uma **função SQL `create_order(...)` (security definer)** que não está no modelo de dados nem tem assinatura definida. Sem isso, a IA vai inventar a assinatura ou fazer inserts sequenciais sem atomicidade (viola "transação").

### A3. Rate limit: onde conta?
"5 pedidos/hora/IP/loja via `ip_hash`". Perguntas sem resposta:
- Conta consultando `orders` (só pedidos criados) — então 429 só após 5 sucessos, e tentativas não contaminam?
- Ou tabela própria `rate_limit_hits` (não existe no modelo)?
O `idx_orders_store_ip_created` sugere contar em `orders`, mas a SPEC não afirma. Divergência muda comportamento de abuse real.

### A4. `promised_at`: como é calculado?
Aparece no pedido, no tracking ("chega ~19:40") e no teste de API, mas **nenhuma regra** diz: `now() + prep_time_max`? min? média? pickup vs delivery diferente? IA vai inventar.

### A5. `code` de 4 chars: escopo de unicidade no tempo
`unique (store_id, code)` é **para sempre**, mas o kanban mostra "hoje" e o código é exibido curto no card/impressão — implicando ciclo diário. Perguntas: o código é único por loja por **dia** (constraint `(store_id, code, date)`)? Ou global permanente (32^4 ≈ 1M combinações, colisões crescem com o tempo)? A SPEC não diz. Impacta constraint, retry e testes.

### A6. Salt diário do `ip_hash`: onde mora?
"sha256 IP + salt diário" — o salt é env var? tabela? gerado como? Rotaciona quando? Sem resposta, cada implementação vaza/fingerprint diferente.

### A7. Senha provisória do lojista: mecanismo
Admin "cria loja (slug + dono + senha provisória)" e "reset senha". Nada diz: `supabase.auth.admin.createUser`? Convite por e-mail está fora de escopo (sem e-mail v1)... então a senha provisória é **definida manualmente pelo operador e entregue por fora**? E "reset senha" gera nova senha provisória exibida uma vez? Precisa estar escrito — envolve Auth Admin API que não é mencionada na SPEC.

### A8. Cancelamento do cliente: janela de tempo?
Cliente cancela em `new`/`confirmed` — mas **para sempre**? Um pedido `new` de ontem (loja não atendeu) ainda pode ser cancelado pelo link? E a janela "não finalizados + hoje" esconde pedidos antigos do painel, mas eles continuam `new` — viram lixo eterno? Falta regra de expiração/limpeza (ex.: `system` cancela `new` > Xh?).

### A9. `troco` (change_for): validação
`change_for_cents` existe sem regra. Óbvio implícito: só faz sentido com `payment_method='cash'` e `change_for >= total`. A SPEC não obriga — IA pode aceitar troco de R$10 para pedido de R$50.

### A10. Bairro desativado entre carrinho e checkout
A SPEC trata produto indisponível (422 com nome), mas não diz o que acontece se o **bairro** foi desativado/removido ou a **taxa mudou** entre o cliente montar o carrinho e enviar. `price_changed` cobre taxa? Provavelmente, mas não está escrito.

### A11. Cancelamento com motivo: quem vê o motivo?
`cancellation_reason` gravado; tracking do cliente mostra o motivo? O painel mostra na timeline? Não especificado.

## B — Gaps técnicos (IA diverge na implementação)

### B1. Storage de imagens inexistente no modelo
Logo da loja e fotos de produto vão para Supabase Storage, mas: nome do bucket, convenção de path (`stores/{id}/logo.webp`?), políticas de acesso do bucket (público? RLS de storage?), tamanho/formato do logo — nada definido.

### B2. WebP client-side — mecanismo
`image.ts` com `pickQuality`/`shouldRejectType`, mas não diz: canvas API? lib externa (`browser-image-compression`)? dimensão máxima (ex.: 1200px)? Sem isso, output varia.

### B3. Som do painel
"Som + toast" — qual arquivo? Asset no repo `/public/sounds/`? Formato? Desbloqueio de autoplay (browsers exigem interação prévia — é requisito UX real do "risco nº 1")? Nada.

### B4. Badge no título/favicon
"Contador no título/favicon da aba" — título é trivial (`document.title`); favicon dinâmico exige técnica (canvas → data URL). SPEC não escolhe.

### B5. Resposta de erro da API: formato canônico
Códigos citados soltos (`STORE_CLOSED`, `DUPLICATE`, `RATE_LIMIT`, `BAIRROS_NAO_CONFIGURADOS`) mas nenhum contrato: `{ error: { code, message } }`? Status HTTP por código? Lista fechada de códigos? O front precisa disso para mapear mensagens PT-BR.

### B6. `price_changed` / `confirmedPriceDiff`: contrato
O fluxo (7.g) não define shape da resposta 409/422 com diff, nem o campo de confirmação no re-envio (nome, formato). IA vai inventar dos dois lados.

### B7. Busca client-side: normalização
Busca por nome/descrição — ignora acentos? case? "ação" acha "acao"? Não definido (decisão UX real em PT-BR).

### B8. "Hoje" do kanban: fuso do corte
Janela "não finalizados + hoje" — meia-noite em qual TZ? Presumivelmente `America/Sao_Paulo` (decisão 13), mas não está escrito na regra do kanban. **E atenção: o contexto atual do projeto é `America/Manaus` — divergência já sinalizada e não resolvida na SPEC.**

### B9. Tracking "mascarado": o que mascara?
`GET /api/orders/track/[token]` "mascarado" — mascara o quê? Telefone? Endereço do próprio cliente? Provavelmente nada (o token é o segredo), mas a palavra "mascarado" sem definição faz a IA esconder campos que o cliente precisa ver (endereço da própria entrega).

### B10. Column grant × RPC: redundância/conflito não explicada
Seção 6 dá `grant update (status, ...)` ao authenticated **e** diz que `set_order_status` é a "única via". Podem coexistir (grants como rede de segurança), mas sem a frase a IA pode concluir que deve revogar o update direto — quebrando o teste RLS nº 4, que testa exatamente o grant.

### B11. `sort_order` de categorias/produtos: UI de ordenação
"Categorias ordenáveis" — drag-and-drop? setas? Reatribuição em lote? Não definido.

### B12. Impressão 80mm: conteúdo do cupom
`@page` definido, mas o **layout do cupom** não: cabeçalho com logo? código grande? itens com addons? quebra de linha em 32/42 colunas? Corte? IA vai inventar o cupom inteiro.

### B13. Admin anonimizar pedido: como o operador acha o pedido?
Admin tem só lista de lojas. "Anonimizar pedido" exige buscar pedido por... código? telefone? dentro da tela da loja? UI e rota não definidas (só existe a API).

### B14. Middleware/guards de rota
`requireStore`/`requireAdmin` citados, mas: onde roda (middleware.ts? layout server?) e o que acontece quando lojista tem `store_id` nulo ou loja desativada — redirect para onde? "Painel 'desativada pelo operador'" implica uma tela que não está na seção 8.

### B15. Tempos: `prep_time_min/max` — unidade e uso
Minutos, presumivelmente. Usado só para display na vitrine ("40-60 min")? Ou alimenta `promised_at` (ver A4)? SPEC não conecta os dois.

### B16. `wa.me` do tracking: conteúdo da mensagem
"Botão wa.me" — mensagem pré-preenchida com código do pedido? (`wa.ts` "normaliza dígitos" mas não define template da mensagem.)

### B17. Vitrine fora de horário: carrinho ainda funciona?
"Banner + checkout desabilitado" — cliente pode montar carrinho e só não finaliza? Presumido, não escrito.

### B18. SEO/metadata da vitrine
Título/OG da página da loja (nome, descrição, logo)? Nada definido.

## C — Convenções (baixo impacto, mas divergem)

- **C1.** Lista de env vars não enumerada (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, salt do IP...).
- **C2.** Tooling de migrações (Supabase CLI? SQL manual?) e comando de rodar `tests/rls.sql` no CI.
- **C3.** Honeypot: nome/campo não especificado.
- **C4.** Mensagens PT-BR exatas dos erros não são fornecidas (só descrições) — cada implementação escreve texto diferente.
- **C5.** `addons` jsonb em `order_items`: shape do snapshot (`[{name, price_cents, qty}]`?) não definido.
- **C6.** Limite "30 linhas" de itens no pedido aparece nos Números Finais mas não no checkout nem no schema (sem check).
- **C7.** Limite 200 produtos/loja: enforcement onde (trigger? server? contagem na UI)?
- **C8.** Paginação da lista de lojas no admin.

---

## Resumo

| Severidade | Qtde | Impacto |
|---|---|---|
| A (regra de negócio) | 11 | IA inventa comportamento central (transação, rate limit, promessa de entrega, código, auth) |
| B (técnico) | 18 | IA diverge em storage, contratos de API, impressão, guards, som |
| C (convenção) | 8 | Divergências menores |

**Os 5 mais perigosos:** A1 (profiles), A2 (create_order), A4 (promised_at), A5 (escopo do code), A7 (senha provisória) — todos envolvem **banco e auth**, o pior lugar para a IA improvisar em projeto multi-tenant com RLS.
