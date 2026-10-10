import { NextResponse } from "next/server";

// Formato de erro SPEC §11: { error: { code, message } } — copy DS §8.4 em PT-BR.
export function apiError(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: { code, message }, ...extra }, { status });
}

// Mapeia a mensagem de exceção do RPC create_order (002: raise exception 'CODE[: arg]') p/ HTTP.
export type MappedOrderError = { status: number; code: string; message: string; extra?: Record<string, unknown> };

const TABLE: Record<string, { status: number; message: string; code?: string }> = {
  RATE_LIMIT: { status: 429, message: "Você já fez muitos pedidos. Tente de novo mais tarde." },
  DUPLICATE: { status: 409, message: "Já temos um pedido seu nos últimos 60 segundos." },
  STORE_CLOSED: { status: 409, message: "A loja está fechada agora." },
  STORE_NOT_FOUND: { status: 404, message: "Loja não encontrada." },
  STORE_INACTIVE: { status: 404, code: "STORE_NOT_FOUND", message: "Loja não encontrada." },
  BAIRROS_NAO_CONFIGURADOS: { status: 422, message: "Ainda não há bairros configurados — só retirada." },
  MIN_ORDER: { status: 422, message: "Pedido abaixo do mínimo da loja." },
  TROCO_INSUFICIENTE: { status: 400, message: "Troco insuficiente — informe um valor ≥ total." },
  PRICE_CHANGED: { status: 409, message: "Alguns preços mudaram desde que você montou o pedido." },
  INVALID_CEP: { status: 422, message: "CEP obrigatório com 8 dígitos." },
  ADDRESS_REQUIRED: { status: 422, message: "Endereço incompleto p/ entrega." },
  NEIGHBORHOOD_INVALID: { status: 422, message: "Bairro indisponível — escolha outro." },
  // validações de entrada: copy genérica (DS §8.4), code = própria exceção
  INVALID_NAME: { status: 400, message: "Dados do pedido inválidos." },
  INVALID_PHONE: { status: 400, message: "Dados do pedido inválidos." },
  INVALID_TYPE: { status: 400, message: "Dados do pedido inválidos." },
  INVALID_PAYMENT: { status: 400, message: "Dados do pedido inválidos." },
  EMPTY_CART: { status: 400, message: "Dados do pedido inválidos." },
  TOO_MANY_LINES: { status: 400, message: "Dados do pedido inválidos." },
  NOTES_TOO_LONG: { status: 400, message: "Dados do pedido inválidos." },
  CODE_EXHAUSTED: { status: 500, message: "Não foi possível gerar o código do pedido. Tente de novo." },
};

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function mapOrderError(pgMessage: string): MappedOrderError {
  const i = pgMessage.indexOf(":");
  const key = (i === -1 ? pgMessage : pgMessage.slice(0, i)).trim();
  const arg = i === -1 ? "" : pgMessage.slice(i + 1).trim();

  if (key === "ITEM_UNAVAILABLE")
    return { status: 422, code: key, message: arg && !isUuid(arg) ? `${arg} saiu do cardápio.` : "Item indisponível." };

  if (key === "PRICE_CHANGED") {
    const m = /original=(\d+) corrigido=(\d+)/.exec(pgMessage);
    return {
      status: 409,
      code: key,
      message: TABLE.PRICE_CHANGED.message,
      extra: m ? { original_total: Number(m[1]), corrected_total: Number(m[2]) } : undefined,
    };
  }

  const row = TABLE[key];
  return row
    ? { status: row.status, code: row.code ?? key, message: row.message }
    : { status: 500, code: "UNEXPECTED", message: "Erro inesperado. Tente de novo." };
}

// Mapeia a mensagem de exceção do RPC set_order_status + trigger de transição
// (002: 'CODE[: detalhe]'). UNAUTHORIZED é gerado pela rota (sessão), mas fica
// aqui para quem chamar o map com ele não virar 500.
const STATUS_TABLE: Record<string, { status: number; message: string }> = {
  UNAUTHORIZED: { status: 401, message: "Faça login para continuar." },
  NOT_YOUR_STORE: { status: 403, message: "Esse pedido não é da sua loja." },
  ORDER_NOT_FOUND: { status: 404, message: "Pedido não encontrado." },
  INVALID_STATUS: { status: 400, message: "Status inválido." },
  INVALID_ACTOR: { status: 400, message: "Ator inválido." },
  FINAL_STATE: { status: 400, message: "Pedido já entregue — status final." },
  INVALID_TRANSITION: { status: 400, message: "Transição de status não permitida." },
  REASON_REQUIRED: { status: 400, message: "Cancelamento exige um motivo (3+ caracteres)." },
  IMMUTABLE_COLUMNS: { status: 400, message: "Dados do pedido não podem ser alterados." },
};

export function mapStatusError(pgMessage: string): MappedOrderError {
  const i = pgMessage.indexOf(":");
  const key = (i === -1 ? pgMessage : pgMessage.slice(0, i)).trim();
  const row = STATUS_TABLE[key];
  return row
    ? { status: row.status, code: key, message: row.message }
    : { status: 500, code: "UNEXPECTED", message: "Erro inesperado. Tente de novo." };
}
