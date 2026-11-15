// Repro: "Editar" dentro da sacola abre o modal de produto ATRÁS da própria sacola
// → CTA "Salvar" não é clicável (z-index igual, sacola vem depois no DOM).
import { launch, BASE, SLUG, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const page = await ctx.newPage();
await page.setViewportSize(VIEWPORTS.desktop);
await page.goto(`${BASE}/${SLUG}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Aceitar" }).click().catch(() => {});
await page.locator('button[aria-label="Adicionar x-salada"]').click();
await page.waitForTimeout(1000);
await page.locator('.pdetail-option:has-text("Mussarela") input').check();
await page.waitForTimeout(300);
await page.locator(".pdetail-cta").click();
await page.waitForTimeout(800);
await page.locator(".cartbar").click();
await page.waitForTimeout(800);
await page.locator('[aria-label="Sacola"] .cartitem-edit').click();
await page.waitForTimeout(1200);

const diag = await page.evaluate(() => {
  const cta = document.querySelector(".pdetail-cta");
  const r = cta.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const top = document.elementFromPoint(cx, cy);
  const overlays = [...document.querySelectorAll(".sheet-overlay")].map((o) => ({
    z: getComputedStyle(o).zIndex,
    cls: o.className,
    label: o.querySelector('[role="dialog"]')?.getAttribute("aria-label"),
    rect: o.getBoundingClientRect().toJSON(),
  }));
  return {
    ctaRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    ctaText: cta.innerText.replace(/\n/g, " "),
    ctaDisabled: cta.disabled,
    elementAtCta: top ? `${top.tagName}.${(top.className || "").toString().slice(0, 40)}` : null,
    overlays,
    modalVisible: !!document.querySelector(".pdetail-dialog"),
  };
});
console.log(JSON.stringify(diag, null, 1));
await page.screenshot({ path: "qa-screenshots/bug-editar-item-zindex.png", fullPage: false, scale: "css" });

// tenta clicar no CTA (sem force) — deve falhar
try {
  await page.locator(".pdetail-cta").click({ timeout: 5000 });
  console.log("RESULTADO: CTA clicável (BUG NAO REPRODUZIU)");
} catch (e) {
  console.log("RESULTADO: CTA NAO CLICÁVEL ->", e.message.split("\n")[0]);
  console.log(e.message.split("\n").filter(l => l.includes("intercepts") || l.includes("disabled")).join("\n"));
}
await browser.close();
