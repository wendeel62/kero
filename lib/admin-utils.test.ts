// Termo de busca p/ PostgREST .or(): vírgula/parênteses quebram a cláusula,
// % vira wildcard — remove estruturais, mantém o resto.
import { expect, test } from "vitest";

import { sanitizeLikeTerm } from "./admin-utils";

test("sanitizeLikeTerm: remove o que quebra o or()", () => {
  expect(sanitizeLikeTerm("pizza-do-joao")).toBe("pizza-do-joao");
  expect(sanitizeLikeTerm("a,b")).toBe("ab");
  expect(sanitizeLikeTerm("pizza (joao)")).toBe("pizza joao");
  expect(sanitizeLikeTerm("100%")).toBe("100");
  expect(sanitizeLikeTerm("a_b")).toBe("ab");
  expect(sanitizeLikeTerm("  ")).toBe("");
});
