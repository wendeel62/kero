// Pós-venda tem página própria: /[slug]/pedido/[token] renderiza o
// acompanhamento (status + resumo) e sobrevive a F5.
import { expect, test } from "@playwright/test";

import { e2ePhone, readE2EStore } from "./helpers";

test("acompanhamento do pedido em página própria", async ({ page, request }) => {
  const st = readE2EStore();
  const res = await request.post("/api/orders", {
    data: {
      store_id: st.storeId, customer_name: "Cliente E2E", customer_phone: e2ePhone(3),
      type: "pickup", payment_method: "pix", change_for_cents: null, notes: null,
      address: null, items: [{ id: st.productId, qty: 1, addons: [], notes: null }],
      total_cents: st.price, website: "", confirmedPriceDiff: false,
    },
  });
  expect(res.status()).toBe(201);
  const { tracking_token } = await res.json();

  await page.goto(`/${st.slug}/pedido/${tracking_token}`);
  const track = await (await request.get(`/api/orders/track/${tracking_token}`)).json();
  await expect(page.locator("h1")).toHaveText(`Pedido #${track.code}`);
  await expect(page.getByText("Resumo do pedido")).toBeVisible();

  // F5 mantém a página (não volta pra vitrine)
  await page.reload();
  await expect(page.locator("h1")).toHaveText(`Pedido #${track.code}`);
});
