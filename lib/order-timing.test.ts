import { test, expect } from "vitest";
import { minutesInStatus } from "./order-timing";

const NOW = new Date("2026-10-11T14:30:00Z").getTime();
const min = (n: number) => new Date(NOW - n * 60_000).toISOString();

test("usa o evento mais recente que levou ao status atual", () => {
  const events = [
    { to_status: "confirmed", created_at: min(30) },
    { to_status: "preparing", created_at: min(12) },
  ];
  expect(minutesInStatus(events, "preparing", min(30), NOW)).toBe(12);
});

test("sem evento, cai no tempo desde a criação", () => {
  expect(minutesInStatus([], "new", min(45), NOW)).toBe(45);
});

test("ignora eventos de outros status e pega o último do status atual", () => {
  const events = [
    { to_status: "confirmed", created_at: min(40) },
    { to_status: "preparing", created_at: min(20) },
    { to_status: "ready", created_at: min(5) },
  ];
  // status atual é preparing: o evento ready é mais novo mas não é o atual
  expect(minutesInStatus(events, "preparing", min(40), NOW)).toBe(20);
});

test("nunca devolve negativo (relógio do cliente adiantado)", () => {
  const events = [{ to_status: "preparing", created_at: min(-5) }];
  expect(minutesInStatus(events, "preparing", min(-5), NOW)).toBe(0);
});
