// Rate limit: 6 checkouts do mesmo IP (fones distintos p/ não cair no dedup) → 6º 429.
import { expect, test } from "@playwright/test";

import { e2ePhone, readE2EStore } from "./helpers";

test("6º pedido do mesmo IP em 1h → 429 RATE_LIMIT", async ({ request }) => {
  const st = readE2EStore();
  const ip = "198.51.100.77";
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const res = await request.post("/api/orders", {
      headers: { "x-forwarded-for": ip },
      data: {
        store_id: st.storeId, customer_name: "Cliente E2E", customer_phone: e2ePhone(10 + i),
        type: "pickup", payment_method: "pix", change_for_cents: null, notes: null,
        address: null, items: [{ id: st.productId, qty: 1, addons: [], notes: null }],
        total_cents: st.price, website: "", confirmedPriceDiff: false,
      },
    });
    last = res.status();
    expect(last).toBe(i < 5 ? 201 : 429);
  }
  expect(last).toBe(429);
});
