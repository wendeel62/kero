// Consentimento LGPD — paridade com cardapio-digital CookieBanner.tsx.
// Chave e valores idênticos ao original ('lgpd-consentimento': 'aceito'|'recusado').
// Storage injetado para testar sem jsdom; produção passa localStorage.
export const CHAVE_CONSENTIMENTO = "lgpd-consentimento";
export type Consentimento = "aceito" | "recusado";

type Leitura = Pick<Storage, "getItem">;
type Escrita = Pick<Storage, "setItem">;

export function lerConsentimento(s: Leitura): Consentimento | null {
  const v = s.getItem(CHAVE_CONSENTIMENTO);
  return v === "aceito" || v === "recusado" ? v : null;
}

export function salvarConsentimento(s: Escrita, v: Consentimento): void {
  s.setItem(CHAVE_CONSENTIMENTO, v);
}

/** Rastreamento (pixel/GA4) só com consentimento aceito — igual ao original. */
export function deveRastrear(s: Leitura): boolean {
  return lerConsentimento(s) === "aceito";
}
