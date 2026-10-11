// SPEC §10: máquina de estados — inclui confirmed→preparing; delivered final.
import { expect, test } from "vitest";

import { canTransition, nextStatus, ORDER_STATUSES } from "./order-status";

test("cadeia feliz new→confirmed→preparing→ready|out→delivered", () => {
  expect(canTransition("new", "confirmed")).toBe(true);
  expect(canTransition("confirmed", "preparing")).toBe(true);
  expect(canTransition("preparing", "ready")).toBe(true);
  expect(canTransition("preparing", "out")).toBe(true);
  expect(canTransition("ready", "delivered")).toBe(true);
  expect(canTransition("out", "delivered")).toBe(true);
});

test("cancelled de qualquer um exceto delivered; delivered é final", () => {
  for (const s of ["new", "confirmed", "preparing", "ready", "out"] as const) {
    expect(canTransition(s, "cancelled")).toBe(true);
  }
  expect(canTransition("delivered", "cancelled")).toBe(false);
  expect(canTransition("delivered", "new")).toBe(false);
  expect(canTransition("cancelled", "new")).toBe(false);
});

test("saltos proibidos", () => {
  expect(canTransition("new", "preparing")).toBe(false);
  expect(canTransition("new", "delivered")).toBe(false);
  expect(canTransition("confirmed", "delivered")).toBe(false);
  expect(canTransition("new", "new")).toBe(false);
});

test("nextStatus avança um clique; ready/out desembocam em delivered", () => {
  expect(nextStatus("new")).toBe("confirmed");
  expect(nextStatus("confirmed")).toBe("preparing");
  expect(nextStatus("preparing")).toBe("ready");
  expect(nextStatus("ready")).toBe("delivered");
  expect(nextStatus("out")).toBe("delivered");
  expect(nextStatus("delivered")).toBeNull();
  expect(nextStatus("cancelled")).toBeNull();
});

test("7 estados conhecidos", () => {
  expect(ORDER_STATUSES).toHaveLength(7);
});
