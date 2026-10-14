export type GeocodeInput = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
};

export type Coords = { lat: number; lng: number };

export function posicaoValida(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Distância em km entre dois pontos (haversine, raio médio da Terra).
export function distanciaKm(a: Coords, b: Coords): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// "850 m" | "2,3 km" | "12 km" — pt-BR, sem decimal a partir de 10 km.
export function formataDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km`;
}

// Distância loja → endereço do pedido, pronta p/ exibir. null se faltar
// coordenada válida (loja sem ponto fixo ou pedido sem pino confirmado).
export function distanciaLojaCliente(loja: Coords | null, address: unknown): string | null {
  const a = address as { lat?: unknown; lng?: unknown } | null;
  if (!loja || !a) return null;
  const lat = Number(a.lat);
  const lng = Number(a.lng);
  if (!posicaoValida(lat, lng)) return null;
  return formataDistancia(distanciaKm(loja, { lat, lng }));
}

export function normalizeAddress(input: GeocodeInput): string {
  const parts = [input.cep, input.street, input.number, input.neighborhood, input.city]
    .map((v) => v?.trim().toLowerCase())
    .filter(Boolean);
  return parts.join("|");
}

type BrasilApiCep = {
  logradouro?: string;
  localidade?: string;
  uf?: string;
  location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
};

type LocationIqResult = { lat: string; lon: string }[];

export async function geocodeExternal(
  input: GeocodeInput,
  fetchImpl: typeof fetch = fetch,
): Promise<Coords | null> {
  // 1. CEP na BrasilAPI
  const cepDigits = input.cep?.replace(/\D/g, "");
  let brasilData: BrasilApiCep | null = null;
  if (cepDigits?.length === 8) {
    try {
      const res = await fetchImpl(`https://brasilapi.com.br/api/cep/v2/${cepDigits}`);
      if (res.ok) brasilData = await res.json();
    } catch {
      // BrasilAPI fora do ar — segue
    }
  }

  // 2. LocationIQ
  const key = process.env.LOCATIONIQ_KEY;
  const hasAddress = Boolean(input.street || input.number || input.neighborhood || input.city);
  if (key && hasAddress) {
    const city = input.city || brasilData?.localidade;
    const uf = brasilData?.uf;
    const parts = [
      [input.street, input.number].filter(Boolean).join(" "),
      input.neighborhood,
      city && uf ? `${city}-${uf}` : city,
      input.cep,
      "Brasil",
    ].filter(Boolean);
    const q = parts.join(", ");
    try {
      const res = await fetchImpl(
        `https://us1.locationiq.com/v1/search?key=${key}&q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`,
      );
      if (res.ok) {
        const data = (await res.json()) as LocationIqResult;
        const lat = parseFloat(data[0]?.lat ?? "");
        const lng = parseFloat(data[0]?.lon ?? "");
        if (posicaoValida(lat, lng)) return { lat, lng };
      }
    } catch {
      // LocationIQ falhou — cai no CEP
    }
  }

  // 3. Fallback: coordenada do CEP (BrasilAPI retorna string — parseFloat necessário)
  const lat = parseFloat(String(brasilData?.location?.coordinates?.latitude ?? ""));
  const lng = parseFloat(String(brasilData?.location?.coordinates?.longitude ?? ""));
  if (posicaoValida(lat, lng)) return { lat, lng };

  // 4. Sem coordenada
  return null;
}

export type AddressSuggestion = {
  label: string; street: string; number: string; neighborhood: string; cep: string;
};

type LocationIqAutocomplete = {
  display_place?: string;
  display_address?: string;
  address?: {
    road?: string; house_number?: string; suburb?: string;
    neighbourhood?: string; postcode?: string; city?: string;
  };
}[];

// LocationIQ /v1/autocomplete → sugestões do dropdown de rua. Só o que a UI usa.
export function parseAutocomplete(data: unknown): AddressSuggestion[] {
  if (!Array.isArray(data)) return [];
  return (data as LocationIqAutocomplete)
    .slice(0, 6)
    .map((d) => ({
      label: d.display_address || d.display_place || "",
      street: d.address?.road ?? d.display_place ?? "",
      number: d.address?.house_number ?? "",
      neighborhood: d.address?.suburb ?? d.address?.neighbourhood ?? "",
      cep: (d.address?.postcode ?? "").replace(/\D/g, ""),
    }))
    .filter((s) => s.label !== "");
}

export async function geocodeAddress(input: GeocodeInput): Promise<Coords | null> {
  const queryKey = normalizeAddress(input);
  if (!queryKey) return null;

  // ponytail: import dinâmico — geocode.ts é importado por client components
  // (posicaoValida), e o topo do admin.ts lança se carregar no browser.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: cached } = await admin
    .from("geocode_cache")
    .select("lat,lng,falha,expira_em")
    .eq("query_key", queryKey)
    .maybeSingle();

  if (cached) {
    const expired = cached.expira_em && new Date(cached.expira_em).getTime() < Date.now();
    if (!expired) {
      if (cached.falha) return null;
      if (cached.lat != null && cached.lng != null && posicaoValida(cached.lat, cached.lng)) {
        return { lat: cached.lat, lng: cached.lng };
      }
    }
  }

  const coords = await geocodeExternal(input);

  if (coords) {
    await admin.from("geocode_cache").upsert(
      { query_key: queryKey, lat: coords.lat, lng: coords.lng, falha: false, expira_em: null },
      { onConflict: "query_key" },
    );
    return coords;
  }

  await admin.from("geocode_cache").upsert(
    {
      query_key: queryKey,
      lat: null,
      lng: null,
      falha: true,
      expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "query_key" },
  );
  return null;
}
