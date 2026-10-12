import { test, expect } from "vitest";
import { entregasEmAndamento } from "./kpis";

test("conta só preparing/ready/out — exclui new, delivered e cancelled", () => {
  const orders = [
    { status: "new" }, { status: "preparing" }, { status: "ready" },
    { status: "out" }, { status: "delivered" }, { status: "cancelled" },
    { status: "preparing" },
  ];
  expect(entregasEmAndamento(orders)).toBe(4);
});
