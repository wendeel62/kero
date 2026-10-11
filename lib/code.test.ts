// SPEC §2.26/§11: 4 chars, alfabeto sem I/L/O/0/1.
import { expect, test } from "vitest";

import { CODE_ALPHABET, randomCode } from "./code";

test("alfabeto tem 31 chars sem ambíguos", () => {
  expect(CODE_ALPHABET).toHaveLength(31);
  for (const c of ["I", "L", "O", "0", "1"]) expect(CODE_ALPHABET).not.toContain(c);
});

test("20 códigos: todos 4 chars do alfabeto", () => {
  for (let i = 0; i < 20; i++) {
    const c = randomCode();
    expect(c).toHaveLength(4);
    for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
  }
});
