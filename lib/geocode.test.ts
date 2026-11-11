import { test, expect, vi } from "vitest";
import { normalizeAddress, geocodeExternal, geocodeExternalComOrigem, parseAutocomplete, sugestaoParaGeocodeInput, posicaoValida, distanciaKm, formataDistancia, distanciaLojaCliente, normalizaNome, bairrosCompativeis, ufDeEstado, parseViaCep } from "./geocode";

vi.stubEnv("LOCATIONIQ_KEY", "test-key");

function mockBrasilApi(data: Partial<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  service: string;
  cep: string;
  location: { coordinates: { latitude: string | number; longitude: string | number } };
}> = {}) {
  return {
    ok: true,
    json: async () => ({
      street: "Rua Jerusalém",
      neighborhood: "Coroado",
      city: "Manaus",
      state: "AM",
      service: "viacep",
      cep: "69082-150",
      location: { coordinates: { latitude: -3.10194, longitude: -60.025 } },
      ...data,
    }),
  };
}

function mockLocationIq(data: unknown[] = []) {
  return { ok: true, json: async () => data };
}

function mockBrasilApiFail() {
  return { ok: false, json: async () => ({}) };
}

function mockLocationIqFail() {
  return { ok: false, json: async () => ({}) };
}

function mockAllFail() {
  return { ok: false, json: async () => ({}) };
}

test("posicaoValida: range e finito", () => {
  expect(posicaoValida(-3.1, -60)).toBe(true);
  expect(posicaoValida(NaN, -60)).toBe(false);
  expect(posicaoValida(200, -60)).toBe(false);
  expect(posicaoValida(-3, 999)).toBe(false);
});

test("normalizeAddress: canônico, ignora vazio e caixa", () => {
  expect(normalizeAddress({ cep: "69000000", street: "Rua A", number: "10" })).toBe("69000000|rua a|10");
});

test("geocodeExternal: LocationIQ responde → usa a coordenada dele (com cidade na query)", async () => {
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(String(url));
    if (String(url).includes("brasilapi")) return mockBrasilApi();
    return mockLocationIq([{ lat: "-3.10", lon: "-60.00" }]);
  }) as unknown as typeof fetch;
  const r = await geocodeExternal({ street: "Rua A", number: "10", cep: "69000000" }, fake);
  expect(r).toEqual({ lat: -3.1, lng: -60.0 });
  expect(urls.some((u) => u.includes("locationiq") && u.includes("Manaus"))).toBe(true);
});

test("geocodeExternal: LocationIQ falha → cai no CEP da BrasilAPI", async () => {
  const fake = (async (url: string) => {
    if (String(url).includes("locationiq")) return mockLocationIqFail();
    return mockBrasilApi({ location: { coordinates: { latitude: -3.2, longitude: -60.2 } } });
  }) as unknown as typeof fetch;
  const r = await geocodeExternal({ street: "Rua A", number: "10", cep: "69000000" }, fake);
  expect(r).toEqual({ lat: -3.2, lng: -60.2 });
});

test("geocodeExternal: tudo falha → null", async () => {
  const fake = (async () => mockAllFail()) as unknown as typeof fetch;
  expect(await geocodeExternal({ street: "Rua A", cep: "69000000" }, fake)).toBeNull();
});

test("geocodeExternalComOrigem: só CEP usa a rua da BrasilAPI e devolve origem 'endereco'", async () => {
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(String(url));
    if (String(url).includes("brasilapi")) return mockBrasilApi({ street: "Rua Jerusalém", neighborhood: "Coroado", city: "Manaus", state: "AM" });
    return mockLocationIq([{ lat: "-3.0896424", lon: "-59.9790003" }]);
  }) as unknown as typeof fetch;
  const r = await geocodeExternalComOrigem({ cep: "69082150" }, fake);
  expect(r).toEqual({ lat: -3.0896424, lng: -59.9790003, origem: "endereco", aproximado: true });
  const q = urls.find((u) => u.includes("locationiq"))!;
  expect(q).toContain("Jerusal");
  expect(q).toContain("Coroado");
});

test("geocodeExternalComOrigem: rua homônima — escolhe a do bairro certo, não a primeira", async () => {
  const fake = (async (url: string) => {
    if (String(url).includes("brasilapi")) return mockBrasilApi({ street: "Rua Jerusalém", neighborhood: "Coroado", city: "Manaus", state: "AM" });
    return {
      ok: true,
      json: async () => [
        { lat: "-3.1260903", lon: "-59.9472336", address: { suburb: "Mauazinho" } },
        { lat: "-3.0896424", lon: "-59.9790003", address: { suburb: "Coroado" } },
      ],
    };
  }) as unknown as typeof fetch;
  const r = await geocodeExternalComOrigem({ cep: "69082150" }, fake);
  expect(r).toEqual({ lat: -3.0896424, lng: -59.9790003, origem: "endereco", aproximado: true });
});

test("geocodeExternalComOrigem: LocationIQ cai → centroide do CEP marcado como origem 'cep'", async () => {
  const fake = (async (url: string) => {
    if (String(url).includes("locationiq")) return mockLocationIqFail();
    return mockBrasilApi({ street: "Rua Jerusalém", neighborhood: "Coroado", city: "Manaus", state: "AM", location: { coordinates: { latitude: -3.10194, longitude: -60.025 } } });
  }) as unknown as typeof fetch;
  const r = await geocodeExternalComOrigem({ cep: "69082150" }, fake);
  expect(r).toEqual({ lat: -3.10194, lng: -60.025, origem: "cep", aproximado: true });
});

test("geocodeExternalComOrigem: sem LOCATIONIQ_KEY → origem 'cep' (aproximado, nunca 'endereco')", async () => {
  vi.stubEnv("LOCATIONIQ_KEY", "");
  const fake = (async (url: string) => {
    if (String(url).includes("brasilapi")) return mockBrasilApi({ street: "Rua Jerusalém", neighborhood: "Coroado", city: "Manaus", state: "AM" });
    throw new Error("não deveria chamar o LocationIQ sem chave");
  }) as unknown as typeof fetch;
  const r = await geocodeExternalComOrigem({ cep: "69082150" }, fake);
  expect(r).not.toBeNull();
  expect(r!.lat).toBeCloseTo(-3.10194, 3);
  expect(r!.lng).toBeCloseTo(-60.025, 3);
  expect(r!.origem).toBe("cep");
  expect(r!.aproximado).toBe(true);
  vi.stubEnv("LOCATIONIQ_KEY", "test-key");
});

// dropdown de rua do checkout: LocationIQ /v1/autocomplete → sugestões da UI
test("parseAutocomplete: rua/bairro/cidade/CEP com label curto e descarta sem label", () => {
  const s = parseAutocomplete([
    {
      display_address: "Vila Cidade de Deus, Cidade de Deus, Manaus, Região Geográfica Intermediária de Manaus, Amazonas, 69000-000, Brasil",
      display_place: "Rua Jerusalém",
      address: { name: "Rua Jerusalém", house_number: "123", suburb: "Cidade de Deus", city: "Manaus", state: "Amazonas", postcode: "69000-000" },
    },
    { display_place: "Rua Sem Endereço" },
    { foo: "bar" },
  ]);
  expect(s).toHaveLength(2);
  expect(s[0]).toEqual({
    label: "Rua Jerusalém, 123 — Cidade de Deus, Manaus",
    street: "Rua Jerusalém", number: "123", neighborhood: "Cidade de Deus", city: "Manaus", uf: "Amazonas", cep: "69000000",
  });
  // sem address.road, street cai no name/display_place; label não pode virar o
  // display_address quilométrico
  expect(s[0].label).not.toContain("Região");
});

test("parseAutocomplete: resposta não-array → []", () => {
  expect(parseAutocomplete({ error: "not found" })).toEqual([]);
  expect(parseAutocomplete(null)).toEqual([]);
});

test("sugestaoParaGeocodeInput: mapeia sugestão → GeocodeInput sem lat/lon", () => {
  const s = {
    label: "Rua Jerusalém, 1",
    street: "Rua Jerusalém",
    number: "1",
    neighborhood: "Coroado",
    city: "Manaus",
    uf: "Amazonas",
    cep: "69082150",
  };
  expect(sugestaoParaGeocodeInput(s)).toEqual({
    cep: "69082150",
    street: "Rua Jerusalém",
    number: "1",
    neighborhood: "Coroado",
    city: "Manaus",
  });
});

test("distanciaKm: haversine (Manaus → SP)", () => {
  const d = distanciaKm({ lat: -3.1, lng: -60.0 }, { lat: -23.55, lng: -46.63 });
  expect(d).toBeGreaterThan(2600);
  expect(d).toBeLessThan(2800);
});

test("formataDistancia: metros < 1km", () => {
  expect(formataDistancia(0.5)).toBe("500 m");
});

test("formataDistancia: km com 1 decimal até 10km", () => {
  expect(formataDistancia(2.34)).toBe("2,3 km");
});

test("formataDistancia: km sem decimal a partir de 10km", () => {
  expect(formataDistancia(12.7)).toBe("13 km");
});

test("distanciaLojaCliente: null se faltar coordenada", () => {
  expect(distanciaLojaCliente({ lat: -3, lng: -60 }, {})).toBeNull();
  expect(distanciaLojaCliente(null, { lat: -3, lng: -60 })).toBeNull();
  expect(distanciaLojaCliente({ lat: -3, lng: -60 }, { lat: -23, lng: -46 })).toMatch(/km$/);
});

// bairro sem acento/maiúscula — "Cidade de Deus" ≈ "cidade de deus"
test("normalizaNome + bairrosCompativeis", () => {
  expect(normalizaNome("Cidade de Deus")).toBe("cidade de deus");
  expect(bairrosCompativeis("Cidade de Deus", "cidade de deus")).toBe(true);
  expect(bairrosCompativeis("Coroado", "Coroado")).toBe(true);
  expect(bairrosCompativeis("Centro", "")).toBe(false);
  expect(bairrosCompativeis("Vila Nova", "Vila Nova do Sul")).toBe(true);
});

test("ufDeEstado: nome → sigla (com/sem acento)", () => {
  expect(ufDeEstado("Amazonas")).toBe("AM");
  expect(ufDeEstado("São Paulo")).toBe("SP");
  expect(ufDeEstado("Rio Grande do Sul")).toBe("RS");
  expect(ufDeEstado("AM")).toBeNull();
});

test("parseViaCep: prefere o CEP do bairro certo", () => {
  const r = parseViaCep(
    [
      { cep: "69082-150", bairro: "Coroado" },
      { cep: "69099-000", bairro: "Cidade de Deus" },
    ],
    "Cidade de Deus",
  );
  expect(r).toEqual({ cep: "69099000", bairro: "Cidade de Deus" });
});

test("parseViaCep: sem bairro pedido → primeira; erro/inválido → null", () => {
  expect(parseViaCep([{ cep: "69082-150", bairro: "Coroado" }], "")).toEqual({ cep: "69082150", bairro: "Coroado" });
  expect(parseViaCep([{ erro: true }], "Coroado")).toBeNull();
  expect(parseViaCep({ erro: true }, "Coroado")).toBeNull();
  expect(parseViaCep([], "Coroado")).toBeNull();
});