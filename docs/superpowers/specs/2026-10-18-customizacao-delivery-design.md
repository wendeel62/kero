# Design: Customizações de Delivery — Todos os Nichos

**Status:** aprovado (escopo fechado com o dono)
**Data:** 2026-10-18

---

## Intent

Suportar todos os nichos de delivery no Kero, permitindo que um lojista configure produtos com customizações ricas — tamanhos, sabores com regras de preço, complementos incluídos vs. pagos, remoções, combos, ponto da carne, meio a meio, montagem peça a peça, observações, personalização e agendamento.

## Goals

1. **Tamanho com preço próprio** — P/M/G substituem o preço base
2. **Regra de preço por grupo** — mais caro / média / soma
3. **Incluídos vs. pagos** — "até X grátis, extras pagos"
4. **Remoções sem custo** — "sem cebola", "sem tomate"
5. **Combos com preço fechado** — kit, burger+batata+bebida
6. **Ponto / preparo** — mal passado, ao ponto, bem passado (preço zero)
7. **Meio a meio** — metade sabor A, metade sabor B
8. **Montagem peça a peça** — mínimo/máximo por tipo
9. **Observações livres** — campo de texto por item
10. **Personalização de encomenda** — nome, mensagem, tema
11. **Agendamento** — data de entrega/retirada
12. **Molhos à parte** — enviar separado

## Non-goals (v1)

- Não integrar com iFood/99Food
- Não fazer split payment
- Não fazer cálculo de custo/ficha técnica
- Não fazer impressão setorizada
- Não fazer delivery tracking em tempo real

## Anti-goals

- Não criar um sistema de "variações" genérico demais que confunda o lojista
- Não permitir regras que quebrem o cálculo de preço no servidor (o servidor é a única fonte de preço)
- não complicar o PDV (balcão) — a customização é para a vitrine

## Constraints

- Schema em inglês, UI em pt-BR
- Servidor é a ÚNICA fonte de preço (recalcula no `pdv_create_order` e no checkout)
- Migrations sequenciais, sem correção
- RLS multi-store (tudo por `store_id`)
- UI: `app/painel/cardapio` (lojista) + `app/[slug]/storefront-client.tsx` (cliente)
- 200 produtos ativos por loja (teto existente)

## Decisões (minhas, o dono pode revisar)

| # | Decisão | Razão |
|---|---------|-------|
| 1 | **Tamanho = variação de produto** (não complemento) | Complemento é aditivo; tamanho substitui a base. Criar tabela `product_variations`. |
| 2 | **Regra de preço no grupo** (`price_rule` enum: `sum` / `max` / `avg`) | O grupo sabe como calcular. Servidor aplica a regra. |
| 3 | **Incluídos = campo no grupo** (`free_addons` int) | Os primeiros X complementos do grupo são grátis. |
| 4 | **Remoção = complemento com preço 0 e flag `is_removal`** | Reusa o mecanismo existente. |
| 5 | **Combo = novo entidade `combos`** com preço próprio e lista de itens | Não dá para fazer com grupos — precisa de preço fechado. |
| 6 | **Ponto = grupo com `is_preparation=true`** | Opções de preço zero, só um campo semântico. |
| 7 | **Meio a meio = 2 grupos obrigatórios** (já funciona) | Não precisa de código novo — só documentar. |
| 8 | **Peça a peça = `min_choices` no grupo** | Cliente escolhe N peças, cada uma com preço. |
| 9 | **Observações = campo `notes` no item do carrinho** (já existe) | Só precisa expor na UI. |
| 10 | **Personalização = `custom_fields` no produto** | Campos de texto livre (nome, mensagem, tema). |
| 11 | **Agendamento = campo `promised_at` já existe** | Só precisa de UI para o cliente escolher a data. |
| 12 | **Molhos à parte = flag `is_separate` no complemento** | O item vai para o pedido com marcação. |

## Modelo de Dados

### Novas tabelas

```sql
-- Variações de produto (tamanho P/M/G, 200ml/500ml, etc.)
create table product_variations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  product_id uuid not null references products on delete cascade,
  name text not null,                    -- "P", "M", "G", "500ml"
  price_cents integer not null check (price_cents >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (id, store_id),
  unique (product_id, name)
);

-- Combos (preço fechado, conjunto de itens)
create table combos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique (id, store_id)
);

create table combo_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  combo_id uuid not null references combos on delete cascade,
  product_id uuid not null references products on delete cascade,
  qty integer not null default 1 check (qty >= 1),
  optional boolean not null default false,  -- true = pode remover
  sort_order integer not null default 0
);

-- Campos de personalização (nome, mensagem, tema do bolo)
create table product_custom_fields (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  product_id uuid not null references products on delete cascade,
  label text not null,                   -- "Nome no bolo", "Mensagem"
  required boolean not null default false,
  max_length integer not null default 200,
  sort_order integer not null default 0
);
```

### Alterações em tabelas existentes

```sql
-- Grupos de complemento: regra de preço + incluídos + mínimo
alter table product_addon_groups add column if not exists price_rule text
  check (price_rule in ('sum', 'max', 'avg')) default 'sum';
alter table product_addon_groups add column if not exists free_addons integer
  check (free_addons is null or free_addons >= 0);
alter table product_addon_groups add column if not exists min_choices integer
  check (min_choices is null or min_choices >= 0);
alter table product_addon_groups add column if not exists is_preparation boolean
  default false;  -- ponto da carne, tipo de preparo

-- Complementos: flag de remoção + molho à parte
alter table product_addons add column if not exists is_removal boolean default false;
alter table product_addons add column if not exists is_separate boolean default false;
```

## Fluxo de Preço (servidor)

```
preço_final = (preço_variação ?? preço_base)
            + Σ(grupo => aplicar_regra(grupo, escolhas))

aplicar_regra(grupo, escolhas):
  se grupo.price_rule == 'sum':  # soma todos
    preços = escolhas.map(preço)
    se grupo.free_addons != null:
      preços[0..free] = 0  # primeiros X grátis
    return Σ(preços)
  se grupo.price_rule == 'max':  # mais caro
    return max(escolhas.map(preço)) ?? 0
  se grupo.price_rule == 'avg':  # média
    preços = escolhas.map(preço)
    return Σ(preços) / len(preços) se preços > 0
```

## UI do Lojista (app/painel/cardapio)

### Aba Produtos (existente)
- Campo "Tamanho" → cria variações (P/M/G) com preço
- Grupos de complemento ganham:
  - Regra de preço: soma / mais caro / média
  - Incluídos: "até X grátis"
  - Mínimo: "escolha pelo menos N"
  - Flag "é preparo" (ponto da carne)
  - Flag "é remoção" (sem cebola)
  - Flag "enviar separado" (molhos)

### Nova Aba Combos
- Lista de combos
- Criar combo: nome, preço, foto, itens (produto + qtd, opcional)

### Personalização
- No produto, seção "Campos de personalização"
- Adicionar campo: label, obrigatório, max caracteres

## UI do Cliente (storefront-client.tsx)

### Sheet do produto (existente)
- Se produto tem variações: seletor de tamanho (P/M/G) com preço
- Grupos de complemento:
  - Regra "mais caro" / "média": mostra o preço do grupo (não de cada item)
  - Incluídos: mostra "até X grátis" + "R$Y cada extra"
  - Remoções: mostra "Sem X" (preço zero)
  - Preparo: mostra como grupo normal mas sem preço
- Personalização: campo de texto no sheet
- Observações: campo de texto no carrinho (já existe?)

### Combos
- Categoria "Combos" aparece no menu
- Sheet do combo: mostra itens, preço fechado, permite remover opcionais

## Arquivos a tocar

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/0XX_product_variations.sql` | Nova tabela + RLS |
| `supabase/migrations/XX_combo.sql` | Nova tabela + RLS |
| `supabase/migrations/XX_custom_fields.sql` | Nova tabela + RLS |
| `supabase/migrations/XX_alter_groups.sql` | Colunas novas |
| `supabase/migrations/XX_alter_addons.sql` | Colunas novas |
| `lib/storefront.ts` | Mapper: variações, combos |
| `lib/storefront-cart.ts` | Cálculo com regras |
| `lib/pdv.ts` | Recálculo com regras |
| `lib/painel-actions.ts` | CRUD variações, combos |
| `lib/painel.ts` | Mapper painel |
| `app/painel/cardapio/page.tsx` | UI lojista |
| `app/[slug]/storefront-client.tsx` | UI cliente |
| `lib/painel-utils.ts` | Tipos |

## Verificação

- `npm run test`
- `npm run lint`
- `npm run build`
- Teste manual: criar pizza com tamanho + sabor (mais caro) + complemento incluído → pedir → verificar preço no PDV

## Fase 2 (fora do escopo)

- Impressão setorizada (cozinha, bar, sushi bar)
- Split de entrega
- Ficha técnica / custo
- Integração marketplaces

## O que fica para o builder

- Cada task com subagente novo
- Tasks pequenas e isoladas
- Verificação individual (build + test) antes de avançar
