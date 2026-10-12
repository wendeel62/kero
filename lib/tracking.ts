// Rastreamento (recon §8): ids validados antes de injetar script. Id inválido
// nunca vira <script> — evita pixel quebrado poluindo o console da vitrine.
export function sanitizeTrackingId(kind: "pixel" | "ga4", raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (kind === "pixel") return /^[0-9]{10,20}$/.test(v) ? v : null;
  return /^G-[A-Z0-9]{4,12}$/.test(v) ? v : null;
}

export function trackingEnabled(pixel: string | null, ga4: string | null): boolean {
  return pixel !== null || ga4 !== null;
}
