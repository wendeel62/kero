import { test, expect } from "vitest";
import { courierOnRoute, boardColumns } from "./deliveries";

test("courierOnRoute: só courier com rota aberta (open)", () => {
  const couriers = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
  const routes = [
    { courier_id: "c1", status: "open" },
    { courier_id: "c2", status: "closed" },
  ];
  expect([...courierOnRoute(couriers, routes)]).toEqual(["c1"]);
});

test("boardColumns separa prontas / em rota / concluídas", () => {
  const orders = [
    { status: "ready" }, { status: "out" }, { status: "delivered" },
    { status: "preparing" }, { status: "cancelled" },
  ];
  const c = boardColumns(orders);
  expect(c.prontas).toBe(1);
  expect(c.emRota).toBe(1);
  expect(c.concluidas).toBe(1);
});
