import { describe, expect, it, vi } from "vitest";
import { geocodeExternalComOrigem, type GeocodeResult } from "@/lib/geocode";

// LOCATIONIQ_KEY precisa estar definido para o codigo chamar o LocationIQ
process.env.LOCATIONIQ_KEY = "test-key";

// BUG-005: CEP inválido (99999-999) retorna 200 da BrasilAPI com dados de
// Sarandi/PR (service:"open-cep"). O código deve ignorar esse resultado.
// BUG-005: ponto a mais de 1km do centroide do CEP deve ser marcado aproximado.

const BRASILAPI_CEP_VALIDO = {
  cep: "01001-000", street: "Praça da Sé", city: "São Paulo", state: "SP",
  neighborhood: "Sé", service: "viacep",
  location: { coordinates: { latitude: "-23.5505", longitude: "-46.6333" } },
};

const BRASILAPI_CEP_INVALIDO = {
  cep: "99999-999", street: "Avenida das Torres", city: "Sarandi", state: "PR",
  neighborhood: "Jardim Centro Cívico", service: "open-cep",
  location: { coordinates: { latitude: "-23.4621", longitude: "-51.8969" } },
};

const LOCATIONIQ_PERTO = [{
  lat: "-23.5510", lon: "-46.6340", display_name: "Praça da Sé, São Paulo",
  address: { suburb: "Sé", city: "São Paulo", postcode: "01001-000" },
}];

const LOCATIONIQ_LONGE = [{
  lat: "-23.6854", lon: "-46.5652", display_name: "Rua das Flores, Vila Mariana, São Paulo",
  address: { suburb: "Vila Mariana", city: "São Paulo", postcode: "01001-000" },
}];

function mockFetch(cep: unknown, iq: unknown) {
  return vi.fn(async (url: string) => {
    if (url.includes("brasilapi.com.br")) {
      return { ok: true, json: async () => cep } as Response;
    }
    if (url.includes("locationiq.com")) {
      return { ok: true, json: async () => iq } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

describe("BUG-005: validação de CEP e aproximação", () => {
  it("CEP inexistente (open-cep) não é aceito como válido", async () => {
    const fetchImpl = mockFetch(BRASILAPI_CEP_INVALIDO, []);
    const r = await geocodeExternalComOrigem({ cep: "99999999" }, fetchImpl);
    // sem CEP confiável e sem LocationIQ, não há ponto
    expect(r).toBeNull();
  });

  it("CEP válido usa centroide quando LocationIQ não responde", async () => {
    const fetchImpl = mockFetch(BRASILAPI_CEP_VALIDO, []);
    const r = await geocodeExternalComOrigem({ cep: "01001000" }, fetchImpl);
    expect(r).not.toBeNull();
    expect(r!.lat).toBeCloseTo(-23.5505, 3);
    expect(r!.lng).toBeCloseTo(-46.6333, 3);
    expect(r!.origem).toBe("cep");
    expect(r!.aproximado).toBe(true);
  });

  it("ponto a menos de 1km do centroide não é aproximado", async () => {
    const fetchImpl = mockFetch(BRASILAPI_CEP_VALIDO, LOCATIONIQ_PERTO);
    const r = await geocodeExternalComOrigem({ cep: "01001000", street: "Praça da Sé", number: "1" }, fetchImpl);
    expect(r).not.toBeNull();
    expect(r!.origem).toBe("endereco");
    expect(r!.aproximado).toBe(false);
  });

  it("ponto a mais de 1km do centroide é marcado aproximado", async () => {
    const fetchImpl = mockFetch(BRASILAPI_CEP_VALIDO, LOCATIONIQ_LONGE);
    const r = await geocodeExternalComOrigem({ cep: "01001000", street: "Rua das Flores", number: "123" }, fetchImpl);
    expect(r).not.toBeNull();
    expect(r!.origem).toBe("endereco");
    expect(r!.aproximado).toBe(true);
  });

  it("sem número é sempre aproximado", async () => {
    const fetchImpl = mockFetch(BRASILAPI_CEP_VALIDO, LOCATIONIQ_PERTO);
    const r = await geocodeExternalComOrigem({ cep: "01001000", street: "Praça da Sé" }, fetchImpl);
    expect(r).not.toBeNull();
    expect(r!.aproximado).toBe(true);
  });
});
