// Happy path: vitrine → sacola → checkout (retirada + pix) → tracking com código.
import { expect, test } from "@playwright/test";

import { e2ePhone, readE2EStore } from "./helpers";

test("happy path cria pedido e abre tracking", async ({ page }) => {
  const st = readE2EStore();
  await page.goto(`/${st.slug}`);
  await expect(page.getByText("Produto E2E").first()).toBeVisible();

  await page.getByRole("button", { name: "Adicionar Produto E2E" }).click();
  await page.getByRole("link", { name: /Ver sacola/ }).first().click();
  await page.getByRole("link", { name: /Ir p\/ o checkout/ }).first().click();

  await page.locator("#nome").fill("Cliente E2E");
  await page.locator("#zap").fill(e2ePhone(1));
  // Radio "Retirada" — label visível que contém o input oculto
  await page.getByText("Retirada", { exact: true }).first().click();
  // Radio "Pix" — label visível
  await page.getByText("Pix", { exact: true }).first().click();
  await page.getByRole("button", { name: /Fazer pedido/ }).first().click();

  await expect(page).toHaveURL(/\/pedido\//);
  await expect(page.getByText(/pedido #/i).first()).toBeVisible();
});
