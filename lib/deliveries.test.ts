import { test, expect } from "vitest";
import { courierOnRoute, boardColumns, mapPoints } from "./deliveries";

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

test("mapPoints: extrai coords válidas e ignora as inválidas", () => {
  const pts = mapPoints([
    { id: "a", code: "1", status: "out", address: { lat: -3.1, lng: -60.0 } },
    { id: "b", code: "2", status: "out", address: { street: "X" } },
    { id: "c", code: "3", status: "out", address: { lat: 999, lng: -60 } },
    { id: "d", code: "4", status: "out", address: null },
  ]);
  expect(pts).toEqual([{ id: "a", code: "1", status: "out", lat: -3.1, lng: -60.0 }]);
});
