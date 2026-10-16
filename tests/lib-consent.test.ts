import { describe, expect, it } from "vitest";
import { deveRastrear, lerConsentimento, salvarConsentimento } from "@/lib/consent";

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe("consentimento LGPD (paridade cardapio-digital)", () => {
  it("sem escolha → null e sem rastreio", () => {
    const s = mem();
    expect(lerConsentimento(s)).toBeNull();
    expect(deveRastrear(s)).toBe(false);
  });

  it("aceito → rastreia; recusado → não rastreia", () => {
    const s = mem();
    salvarConsentimento(s, "aceito");
    expect(lerConsentimento(s)).toBe("aceito");
    expect(deveRastrear(s)).toBe(true);
    salvarConsentimento(s, "recusado");
    expect(deveRastrear(s)).toBe(false);
  });

  it("valor estranho → null e sem rastreio", () => {
    const s = mem();
    s.setItem("lgpd-consentimento", "talvez");
    expect(lerConsentimento(s)).toBeNull();
    expect(deveRastrear(s)).toBe(false);
  });
});
