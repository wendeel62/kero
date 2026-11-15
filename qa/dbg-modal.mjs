import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";

const browser = await launch();
const { state } = await login(await browser.newContext({ locale: "pt-BR" }));
const c = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const p = await c.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
await p.goto(`${BASE}/painel/cardapio`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 50; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (t.includes("Categorias") && t.length > 200) break; await p.waitForTimeout(400); }
await p.waitForTimeout(1500);

await p.getByRole("button", { name: /Nova Categoria/i }).click();
await p.waitForTimeout(2000);

const diag = await p.evaluate(() => {
  const out = [];
  for (const i of document.querySelectorAll("input,textarea,select")) {
    const r = i.getBoundingClientRect();
    const cs = getComputedStyle(i);
    const lab = i.labels?.[0];
    out.push({
      tag: i.tagName, type: i.type, id: i.id, name: i.name, ph: i.placeholder,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      disabled: i.disabled,
      labelsCount: i.labels?.length ?? 0,
      labelText: lab ? (lab.innerText || lab.textContent || "").trim().slice(0, 30) : null,
      ariaLabel: i.getAttribute("aria-label"),
      closestLabel: !!i.closest("label"),
      inHiddenAncestor: !!i.closest("[hidden], [aria-hidden='true'], .hidden"),
    });
  }
  return { fields: out, modals: [...document.querySelectorAll('[role="dialog"],dialog,[aria-modal="true"]')].map(d => ({ cls: d.className, txt: (d.innerText||"").slice(0,80), rect: d.getBoundingClientRect().toJSON() })) };
});
console.log(JSON.stringify(diag, null, 1).slice(0, 4000));
await p.screenshot({ path: "qa-screenshots/dbg-modal-categoria.png", fullPage: false, scale: "css" });
await browser.close();
