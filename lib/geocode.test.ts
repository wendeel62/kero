import { test, expect, vi } from "vitest";
import { normalizeAddress, geocodeExternal, posicaoValida } from "./geocode";

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
