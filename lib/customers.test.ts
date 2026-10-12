import { test, expect } from "vitest";
import { aggregateCustomers, classifyCustomer } from "./customers";

test("classifyCustomer: VIP por frequencia OU por gasto", () => {
  expect(classifyCustomer(6, 0)).toBe("vip");           // 6 > 5
  expect(classifyCustomer(1, 50000)).toBe("vip");       // gasto >= R$ 500
  expect(classifyCustomer(5, 49999)).toBe("recorrente"); // nem um nem outro
  expect(classifyCustomer(2, 0)).toBe("recorrente");
  expect(classifyCustomer(1, 2590)).toBe("novo");
  expect(classifyCustomer(0, 0)).toBe("novo");          // só cancelados
});

const row = (phone: string, name: string, cents: number, status = "delivered", at = "2026-10-10T12:00:00Z") =>
  ({ customer_name: name, customer_phone: phone, total_cents: cents, status, created_at: at });

test("agrega por telefone e ignora cancelados no total", () => {
  const out = aggregateCustomers([
    row("55999999999", "Ana", 2590),
    row("55999999999", "Ana", 2590, "cancelled"),
    row("55999999999", "Ana", 3000),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ phone: "55999999999", name: "Ana", orders: 2, spentCents: 5590 });
});

test("cliente so de cancelados fica com 0 pedidos e nunca e VIP", () => {
  const out = aggregateCustomers([
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
    row("55111111111", "Bia", 99999, "cancelled"),
  ]);
  expect(out[0]).toMatchObject({ orders: 0, spentCents: 0, profile: "novo" });
});

test("usa o nome do pedido mais recente e ordena por gasto desc", () => {
  const out = aggregateCustomers([
    row("55222222222", "Nome Antigo", 1000, "delivered", "2026-10-01T12:00:00Z"),
    row("55222222222", "Nome Novo", 1000, "delivered", "2026-10-09T12:00:00Z"),
    row("55333333333", "Rico", 90000, "delivered", "2026-10-02T12:00:00Z"),
  ]);
  expect(out[0].phone).toBe("55333333333");
  expect(out.find((c) => c.phone === "55222222222")?.name).toBe("Nome Novo");
});

test("lastOrderAt e a data do pedido mais recente, inclusive cancelado", () => {
  const out = aggregateCustomers([
    row("55444444444", "Dora", 1000, "delivered", "2026-10-01T12:00:00Z"),
    row("55444444444", "Dora", 1000, "cancelled", "2026-10-08T12:00:00Z"),
  ]);
  expect(out[0].lastOrderAt).toBe("2026-10-08T12:00:00Z");
});
