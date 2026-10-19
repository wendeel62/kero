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
  cep?: string;
  street?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  service?: string;
  location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
};

type LocationIqResult = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: { suburb?: string; neighbourhood?: string; city?: string; postcode?: string };
}[];

// Uma rua se repete em vários bairros (Manaus tem 8 "Rua Jerusalém"). Pegar o
// primeiro resultado (`limit=1`) cai na rua certa no bairro errado. Busca um
// lote e escolhe o que tem o bairro pedido no `suburb`/`display_name`; sem
// bairro confiável, cai na âncora (centroid do CEP) só como último recurso.
function melhorPorBairro(
  data: LocationIqResult,
  bairro: string | undefined,
  ancora: Coords | null,
): Coords | null {
  const alvo = bairro?.trim().toLowerCase();
  const parse = (d: LocationIqResult[number]): Coords | null => {
    const lat = parseFloat(d.lat ?? "");
    const lng = parseFloat(d.lon ?? "");
    return posicaoValida(lat, lng) ? { lat, lng } : null;
  };
  const bairroDe = (d: LocationIqResult[number]): string =>
    (d.address?.suburb ?? d.address?.neighbourhood ?? "").trim().toLowerCase();

  // 1º: bairro bate com `suburb` do addressdetails
  let pool: LocationIqResult = [];
  if (alvo) {
    pool = data.filter((d) => {
      const s = bairroDe(d);
      return s !== "" && (s.includes(alvo) || alvo.includes(s));
    });
    // 2º: bairro aparece no display_name (OSM às vezes põe o bairro só lá)
    if (pool.length === 0) {
      pool = data.filter((d) =>
        (d.display_name ?? "").toLowerCase().includes(alvo),
      );
    }
  }
  // 3º: sem bairro utilizável → todos, e desempata pela âncora do CEP
  const candidatos = pool.length > 0 ? pool : ancora ? data : data.slice(0, 1);

  if (ancora) {
    return candidatos.reduce<Coords | null>((best, d) => {
      const c = parse(d);
      if (!c) return best;
      if (!best) return c;
      return distanciaKm(ancora, c) < distanciaKm(ancora, best) ? c : best;
    }, null);
  }
  return parse(candidatos[0]);
}

/** Resultado de geocodificação + origem, para o chamador avisar o cliente
 *  quando o ponto veio só do CEP (centroide ~5km, bairro errado em Manaus)
 *  ou quando o ponto está a mais de 1km do centroide (sem número). */
export type GeocodeResult = {
  lat: number;
  lng: number;
  /** "endereco" = rua encontrada pelo LocationIQ · "cep" = só centroide do CEP */
  origem: "endereco" | "cep";
  /** true = ponto aproximado, cliente deve confirmar no mapa */
  aproximado: boolean;
};

export async function geocodeExternalComOrigem(
  input: GeocodeInput,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeResult | null> {
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

  // BrasilAPI retorna 200 com dados de OUTRA cidade para CEP inexistente
  // (ex: 99999-999 → Sarandi/PR, campo service:"open-cep"). Nao confiar nesses.
  const cepConfiavel = brasilData?.service !== "open-cep" && !!brasilData?.cep;
  const dadosCep = cepConfiavel ? brasilData : null;

  // 3. Centroide do CEP (BrasilAPI retorna string — parseFloat necessário).
  //    Também é a âncora para escolher a rua certa entre as homônimas.
  const cepLat = parseFloat(String(dadosCep?.location?.coordinates?.latitude ?? ""));
  const cepLng = parseFloat(String(dadosCep?.location?.coordinates?.longitude ?? ""));
  const centroideCep = posicaoValida(cepLat, cepLng) ? { lat: cepLat, lng: cepLng } : null;

  // 2. LocationIQ. Sem chave a única resposta possível é o centroide do CEP, que
  //    em Manaus erra ~5km e às vezes acerta o bairro errado — melhor devolver
  //    "sem ponto" e deixar o cliente confirmar no mapa do que fingir precisão.
  const key = process.env.LOCATIONIQ_KEY;
  if (!key) return centroideCep ? { ...centroideCep, origem: "cep", aproximado: true } : null;

  // Se o chamador mandou só CEP, usa o logradouro/bairro que a BrasilAPI
  // acabou de devolver — sem isso a query fica sem rua e erra o bairro.
  const street = input.street || dadosCep?.street;
  const neighborhood = input.neighborhood || dadosCep?.neighborhood;
  if (street || input.number || neighborhood || input.city) {
    const city = input.city || dadosCep?.city;
    const uf = dadosCep?.state;
    const parts = [
      [street, input.number].filter(Boolean).join(" "),
      neighborhood,
      city && uf ? `${city}-${uf}` : city,
      input.cep,
      "Brasil",
    ].filter(Boolean);
    const q = parts.join(", ");
    try {
      // limit=8 + addressdetails=1: Manaus tem 8 "Rua Jerusalém" (limit=1 pega a
  // errada) e o campo `suburb` — que diz qual bairro é qual — só vem com
  // addressdetails.
      const res = await fetchImpl(
        `https://us1.locationiq.com/v1/search?key=${key}&q=${encodeURIComponent(q)}&format=json&limit=8&countrycodes=br&addressdetails=1`,
      );
      if (res.ok) {
        const data = (await res.json()) as LocationIqResult;
        const coords = melhorPorBairro(data, neighborhood, centroideCep);
        if (coords) {
          // Marca como aproximado: sem número OU ponto a mais de 1km do centroide do CEP.
          const dist = centroideCep ? distanciaKm(centroideCep, coords) : 0;
          const aproximado = !input.number || dist > 1;
          return { ...coords, origem: "endereco", aproximado };
        }
      }
    } catch {
      // LocationIQ falhou — cai no CEP
    }
  }

  // 4. Só o centroid do CEP sobrou — ponto aproximado, sinalizado como tal.
  if (centroideCep) return { ...centroideCep, origem: "cep", aproximado: true };

  // 5. Sem coordenada
  return null;
}

// Compat: chamadas antigas só querem o par de coordenadas.
export async function geocodeExternal(
  input: GeocodeInput,
  fetchImpl: typeof fetch = fetch,
): Promise<Coords | null> {
  const r = await geocodeExternalComOrigem(input, fetchImpl);
  return r ? { lat: r.lat, lng: r.lng } : null;
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

// Mapeia uma sugestão do dropdown (sem coordenada) no input PRECISO do geocoder.
// A origem do pino vem do forward-geocode (/api/geo/geocode), nunca do autocomplete.
export function sugestaoParaGeocodeInput(s: AddressSuggestion): GeocodeInput {
  return {
    cep: s.cep || undefined,
    street: s.street || undefined,
    number: s.number || undefined,
    neighborhood: s.neighborhood || undefined,
  };
}

export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult | null> {
  const queryKey = normalizeAddress(input);
  if (!queryKey) return null;

  // ponytail: import dinâmico — geocode.ts é importado por client components
  // (posicaoValida), e o topo do admin.ts lança se carregar no browser.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: cached } = await admin
    .from("geocode_cache")
    .select("lat,lng,origem,falha,expira_em")
    .eq("query_key", queryKey)
    .maybeSingle();

  if (cached) {
    const expired = cached.expira_em && new Date(cached.expira_em).getTime() < Date.now();
    if (!expired) {
      if (cached.falha) return null;
      if (cached.lat != null && cached.lng != null && posicaoValida(cached.lat, cached.lng)) {
        // entrada antiga (pré-fix) não tem `origem`: assume "cep" (centroide),
        // que é o comportamento seguro — o chamador pede confirmação do pino.
        const origem = (cached as { origem?: GeocodeResult["origem"] }).origem ?? "cep";
        return { lat: cached.lat, lng: cached.lng, origem, aproximado: origem === "cep" };
      }
    }
  }

  const coords = await geocodeExternalComOrigem(input);

  if (coords) {
    await admin.from("geocode_cache").upsert(
      { query_key: queryKey, lat: coords.lat, lng: coords.lng, origem: coords.origem, aproximado: coords.aproximado, falha: false, expira_em: null },
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
