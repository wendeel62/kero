export function posicaoRecente(
  atualizadoEm: string,
  agoraMs: number = Date.now(),
  limiteMin = 3,
): boolean {
  return agoraMs - Date.parse(atualizadoEm) <= limiteMin * 60_000;
}
