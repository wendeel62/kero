// Espelho TS de fn_random_code (002 l.67–73; SPEC §2.26/§11): 4 chars, sem I/L/O/0/1.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars

export function randomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  // ponytail: % 31 tem viés leve (8/31 chars puxam 9/256); irrelevante p/ código de exibição 4 chars — a SQL gera os definitivos.
  return Array.from(bytes, (b) => CODE_ALPHABET[b % 31]).join("");
}
