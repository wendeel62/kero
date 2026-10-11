// Cancelamento pelo cliente: pedido via API → tracking → motivo ≥3 → cancelado.
import { expect, test } from "@playwright/test";

import { e2ePhone, readE2EStore } from "./helpers";

test("cliente cancela com motivo", async ({ page, request }) => {
  const st = readE2EStore();
  const res = await request.post("/api/orders", {
    data: {
      store_id: st.storeId, customer_name: "Cliente E2E", customer_phone: e2ePhone(2),
      type: "pickup", payment_method: "pix", change_for_cents: null, notes: null,
      address: null, items: [{ id: st.productId, qty: 1, addons: [], notes: null }],
      total_cents: st.price, website: "", confirmedPriceDiff: false,
    },
  });
  expect(res.status()).toBe(201);
  const { tracking_token } = await res.json();

  await page.goto(`/${st.slug}/pedido/${tracking_token}`);
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await page.locator("#motivo").fill("mudança de planos");
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(page.getByText("Pedido cancelado")).toBeVisible();
});
