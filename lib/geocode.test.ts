import { test, expect, vi } from "vitest";
import { normalizeAddress, geocodeExternal, parseAutocomplete, posicaoValida, distanciaKm, formataDistancia, distanciaLojaCliente } from "./geocode";

vi.stubEnv("LOCATIONIQ_KEY", "test-key");

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
    if (String(url).includes("brasilapi")) return { ok: true, json: async () => ({ logradouro: "Rua A", localidade: "Manaus", uf: "AM" }) };
    return { ok: true, json: async () => [{ lat: "-3.10", lon: "-60.00" }] };
  }) as unknown as typeof fetch;
  const r = await geocodeExternal({ street: "Rua A", number: "10", cep: "69000000" }, fake);
  expect(r).toEqual({ lat: -3.1, lng: -60.0 });
  expect(urls.some((u) => u.includes("locationiq") && u.includes("Manaus"))).toBe(true);
});

test("geocodeExternal: LocationIQ falha → cai no CEP da BrasilAPI", async () => {
  const fake = (async (url: string) => {
    if (String(url).includes("locationiq")) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ localidade: "Manaus", uf: "AM", location: { coordinates: { latitude: -3.2, longitude: -60.2 } } }) };
  }) as unknown as typeof fetch;
  const r = await geocodeExternal({ street: "Rua A", number: "10", cep: "69000000" }, fake);
  expect(r).toEqual({ lat: -3.2, lng: -60.2 });
});

test("geocodeExternal: tudo falha → null", async () => {
  const fake = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
  expect(await geocodeExternal({ street: "Rua A", cep: "69000000" }, fake)).toBeNull();
});

// dropdown de rua do checkout: LocationIQ /v1/autocomplete → sugestões da UI
test("parseAutocomplete: rua/bairro/CEP e descarta entradas sem label", () => {
  const s = parseAutocomplete([
    {
      display_address: "Rua Ouro Preto, Coroado, Manaus, 69000-000, Brasil",
      address: { road: "Rua Ouro Preto", suburb: "Coroado", postcode: "69000-000" },
    },
    { display_place: "Rua Sem Endereço" },
    { foo: "bar" },
  ]);
  expect(s).toHaveLength(2);
  expect(s[0]).toEqual({
    label: "Rua Ouro Preto, Coroado, Manaus, 69000-000, Brasil",
    street: "Rua Ouro Preto", number: "", neighborhood: "Coroado", cep: "69000000",
  });
});

test("parseAutocomplete: resposta não-array → []", () => {
  expect(parseAutocomplete({ error: "not found" })).toEqual([]);
  expect(parseAutocomplete(null)).toEqual([]);
});

// distância loja → cliente (haversine), usada no painel, no PWA e no acompanhamento
test("distanciaKm: mesmo ponto = 0; 0,1° de latitude ≈ 11,1 km", () => {
  expect(distanciaKm({ lat: -3.1, lng: -60 }, { lat: -3.1, lng: -60 })).toBe(0);
  expect(distanciaKm({ lat: -3.1, lng: -60 }, { lat: -3.2, lng: -60 })).toBeCloseTo(11.12, 1);
});

test("formataDistancia: metros abaixo de 1 km, sem decimal a partir de 10 km", () => {
  expect(formataDistancia(0.85)).toBe("850 m");
  expect(formataDistancia(2.34)).toBe("2,3 km");
  expect(formataDistancia(12.4)).toBe("12 km");
});

test("distanciaLojaCliente: null sem loja ou sem coordenada válida no endereço", () => {
  const loja = { lat: -3.1, lng: -60 };
  expect(distanciaLojaCliente(null, { lat: -3.2, lng: -60 })).toBeNull();
  expect(distanciaLojaCliente(loja, null)).toBeNull();
  expect(distanciaLojaCliente(loja, { street: "Rua A" })).toBeNull();
  expect(distanciaLojaCliente(loja, { lat: 999, lng: -60 })).toBeNull();
  expect(distanciaLojaCliente(loja, { lat: -3.2, lng: -60 })).toBe("11 km");
});
