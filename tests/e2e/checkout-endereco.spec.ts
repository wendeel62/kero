// Checkout > campo de endereço: dropdown de sugestões legível e da cidade da loja.
// Reproduz os dois bugs da vitrine: fundo do dropdown transparente (var(--color-card)
// não existe no storefront.css) e sugestões de outras cidades (LocationIQ sem viés).
// Guard: pula quando o server não tem LOCATIONIQ_KEY (rota devolve suggestions: []).
import { expect, test } from "@playwright/test";

import { readE2EStore } from "./helpers";

const CIDADE_LOJA = "Manaus"; // helpers.ts cria a loja e2e com coordenadas de Manaus

test("campo de endereço: sugestões legíveis, da cidade da loja, e selecionáveis", async ({
  page,
  request,
}, testInfo) => {
  const probe = await request.get("/api/geo/autocomplete?q=Rua%20Jerusal%C3%A9m");
  const probeBody = await probe.json().catch(() => ({}));
  test.skip(
    !Array.isArray(probeBody.suggestions) || probeBody.suggestions.length === 0,
    "server sem LOCATIONIQ_KEY ou LocationIQ fora do ar",
  );

  // banner LGPD não atrapalha os cliques do carrinho
  await page.addInitScript(() => localStorage.setItem("lgpd-consentimento", "recusado"));

  const st = readE2EStore();

  // vitrine → carrinho → checkout (produto e2e não tem grupos obrigatórios)
  await page.goto(`/${st.slug}`);
  await page.locator(".pcard-add").first().click();
  await page.locator(".pdetail-cta").click();
  await page.locator(".cartbar").click();
  await page.locator(".btn-finalizar-carrinho").click();

  const input = page.getByPlaceholder("Rua, número...");
  await expect(input).toBeVisible();

  // digita como cliente real (debounce 300ms dispara o autocomplete)
  const respPromise = page.waitForResponse((r) => r.url().includes("/api/geo/autocomplete"));
  await input.pressSequentially("Rua Jerusalém", { delay: 40 });
  const resp = await respPromise;

  // viés: o pedido deve levar as coordenadas da loja
  expect(resp.url(), "pedido sem lat/lng da loja").toMatch(/lat=-?\d+(\.\d+)?/);
  expect(resp.url(), "pedido sem lat/lng da loja").toMatch(/lng=-?\d+(\.\d+)?/);

  const { suggestions } = (await resp.json()) as { suggestions: Array<{ label: string }> };
  const box = page.locator('ul[role="listbox"]');
  await expect(box).toBeVisible({ timeout: 10000 });

  // sugestões todas da cidade da loja (antes: Rio, POA, Salvador, Goiânia, São Luís)
  expect(suggestions.length).toBeGreaterThan(0);
  for (const s of suggestions) {
    expect(s.label, `sugestão de outra cidade: ${s.label}`).toContain(CIDADE_LOJA);
  }

  // evidência visual do dropdown
  const shot = "/tmp/opencode/checkout-dropdown.png";
  await page.locator("label.form-field.full-width").first().screenshot({ path: shot });
  await testInfo.attach("dropdown", { path: shot, contentType: "image/png" });

  // legibilidade: fundo opaco, contraste WCAG AA (4.5:1), elevação, nada na frente
  const vis = await box.evaluate((ul) => {
    const cs = getComputedStyle(ul);
    const li = ul.querySelector("li")!;
    const liCs = getComputedStyle(li);
    const toRGB = (v: string) => {
      const m = v.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const fg = toRGB(liCs.color);
    const bg = toRGB(cs.backgroundColor);
    const contrast = fg && bg ? (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05) : 0;
    const ulRect = ul.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const top = document.elementFromPoint(
      Math.round(ulRect.left + ulRect.width / 2),
      Math.round(liRect.top + liRect.height / 2),
    );
    return {
      bg: cs.backgroundColor,
      opaque: !!bg && bg.a >= 0.99,
      contrast,
      shadow: cs.boxShadow,
      covered: top !== li && !li.contains(top as Node),
    };
  });
  expect(vis.bg, "fundo do dropdown transparente").not.toBe("rgba(0, 0, 0, 0)");
  expect(vis.opaque, "fundo do dropdown não é opaco").toBe(true);
  expect(vis.contrast, "contraste texto/fundo < 4.5:1").toBeGreaterThanOrEqual(4.5);
  expect(vis.shadow, "dropdown sem elevação (box-shadow)").not.toBe("none");
  expect(vis.covered, "elemento na frente do dropdown").toBe(false);

  // seleção: preenche endereço curto (sem lixo do display_address) + CEP da sugestão
  const geo1 = page.waitForResponse((r) => r.url().includes("/api/geo/geocode") && r.request().method() === "POST");
  await box.locator("li").first().click();
  await geo1;
  const val = await input.inputValue();
  expect(val).toContain("Rua Jerusalém");
  expect(val, "label ainda é o display_address quilométrico").not.toContain("Região");
  await expect(page.getByPlaceholder("00000-000")).toHaveValue(/^\d{8}$/);

  // bairro auto-casado (sugestão → bairro da loja) → select some da tela
  await expect(page.locator("select")).toHaveCount(0);
  const numInput = page.getByPlaceholder("Número", { exact: true });
  await expect(numInput).toBeVisible();
  // digitar o número re-resolve o pino com rua+número (POST /api/geo/geocode)
  const geo2 = page.waitForResponse((r) => r.url().includes("/api/geo/geocode") && r.request().method() === "POST");
  await numInput.fill("150");
  await geo2;
});
