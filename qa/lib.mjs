// QA harness (auditoria 2026-11). Reusa a ideia do qa-audit.mjs anterior, mas
// conserta a porta (3000) e adiciona checagens de layout/acessibilidade.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

export const BASE = process.env.QA_BASE || "http://localhost:3000";
export const OUT = "qa-screenshots";
export const SLUG = "pizzariadokbc";          // loja de teste
export const OTHER_SLUG = "loja-qa-hermes";    // outra loja (isolamento)
export const INACTIVE_SLUG = "pizzariadasol"; // loja desativada
export const STORE_ID = "5751a74b-5feb-41be-be14-6c3967ca1383";
export const OTHER_STORE_ID = "cda9a418-1995-4c6f-86db-cc112fdd3def";
export const LOGIN = { email: "pizzaria123@gmail.com", pass: "LojistaTest2026!" }; // a senha do briefing ("KeroAdmin2026!") não autentica

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

export const findings = [];
export function finding(f) {
  findings.push(f);
  console.log(`  [${f.severity}] ${f.id} ${f.title}`);
}

export async function launch() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  return browser;
}

export function attach(page, bag, label) {
  page.on("console", (m) => {
    const t = m.type();
    if (t === "error" || t === "warning") bag.console.push({ page: label, type: t, text: m.text().slice(0, 500) });
  });
  page.on("pageerror", (e) => bag.console.push({ page: label, type: "pageerror", text: String(e).slice(0, 500) }));
  page.on("requestfailed", (r) => bag.net.push({ page: label, url: r.url().slice(0, 200), status: "FAILED", err: r.failure()?.errorText }));
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400) bag.net.push({ page: label, url: u.slice(0, 200), status: r.status() });
    if (u.includes("/api/")) bag.api.push({ page: label, method: r.request().method(), url: u.slice(0, 160), status: r.status() });
  });
}

export function newBag() {
  return { console: [], net: [], api: [] };
}

/** Abre a página, captura console/rede, mede layout, tira screenshot. */
export async function visit(ctx, url, label, opts = {}) {
  const {
    viewport = "desktop", shot = true, full = false, wait = 2500,
    actions = null, storageState = null, expectUrl = null, click = null,
  } = opts;

  const context = storageState ? await ctx.browser().newContext({ storageState, viewport: VIEWPORTS[viewport], locale: "pt-BR", timezoneId: "America/Sao_Paulo" }) : ctx;
  const page = await context.newPage();
  if (!storageState) await page.setViewportSize(VIEWPORTS[viewport]);
  const bag = newBag();
  attach(page, bag, label);

  const t0 = Date.now();
  let status = null;
  let error = null;
  try {
    const resp = await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 45000 });
    status = resp?.status();
    await page.waitForTimeout(wait);
    if (click) {
      for (const sel of [].concat(click)) {
        const el = page.locator(sel).first();
        if (await el.count()) { await el.click({ timeout: 5000 }).catch((e) => bag.console.push({ page: label, type: "clickfail", text: `${sel}: ${e.message.slice(0,200)}` })); await page.waitForTimeout(1200); }
        else bag.console.push({ page: label, type: "missing", text: `seletor não encontrado: ${sel}` });
      }
    }
    if (actions) await actions(page, bag);
  } catch (e) {
    error = String(e).slice(0, 300);
    bag.console.push({ page: label, type: "navigation", text: error });
  }
  const ms = Date.now() - t0;

  if (shot) {
    await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: full, scale: "css" }).catch(() => {});
  }
  const info = await page.evaluate(() => {
    const de = document.documentElement;
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
    };
    const overflowers = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > de.clientWidth + 2 && r.width < 3000) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" || cs.position === "absolute") continue;
        overflowers.push({ tag: el.tagName, cls: (el.className || "").toString().slice(0, 60), right: Math.round(r.right), text: (el.innerText || "").slice(0, 40) });
      }
    }
    const tiny = [];
    for (const b of document.querySelectorAll("button,a[href],input,select,[role=button]")) {
      if (!vis(b)) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) tiny.push({ tag: b.tagName, label: (b.innerText || b.getAttribute("aria-label") || b.getAttribute("placeholder") || "?").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
    }
    const noLabel = [];
    for (const i of document.querySelectorAll("input,textarea,select")) {
      if (!vis(i)) continue;
      if (i.type === "hidden" || i.type === "radio" || i.type === "checkbox") continue;
      const has = i.labels?.length || i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.closest("label");
      if (!has) noLabel.push({ tag: i.tagName, type: i.type, name: i.name, ph: i.placeholder });
    }
    return {
      title: document.title,
      text: (document.body?.innerText || "").slice(0, 6000),
      scrollW: de.scrollWidth, clientW: de.clientWidth, scrollH: de.scrollHeight,
      overflowX: de.scrollWidth > de.clientWidth + 1,
      overflowers: overflowers.slice(0, 12),
      tinyTargets: tiny.slice(0, 12),
      inputsWithoutLabel: noLabel.slice(0, 12),
      brokenImgs: Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
      imgCount: document.images.length,
      imgNoAlt: Array.from(document.images).filter((i) => !i.hasAttribute("alt")).length,
      btns: Array.from(document.querySelectorAll("button")).map((b) => (b.innerText || b.getAttribute("aria-label") || b.title || "?").trim().replace(/\n/g, " /").slice(0, 40)),
      links: Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")),
      inputs: Array.from(document.querySelectorAll("input,textarea,select")).map((i) => ({
        tag: i.tagName, type: i.type || "", name: i.name || null, id: i.id || null, ph: i.placeholder || null,
        label: i.labels?.[0]?.innerText?.trim() || null, aria: i.getAttribute("aria-label"), required: i.required,
        value: i.type === "password" ? "***" : (i.value || null),
      })),
      tables: Array.from(document.querySelectorAll("table")).map((t) => t.innerText.replace(/\n+/g, " | ").slice(0, 700)),
      dialogs: Array.from(document.querySelectorAll('[role=dialog],dialog,[aria-modal=true]')).map((d) => (d.innerText || "").slice(0, 200)),
      skeletons: document.querySelectorAll('[class*=skeleton],[class*=loading],[class*=animate-pulse]').length,
    };
  }).catch(() => null);

  const finalUrl = page.url();
  await page.close();
  if (storageState) await context.close();

  return { label, url, status, ms, finalUrl, error, bag, info, expectUrl };
}

export function dump(rows) {
  const out = [];
  for (const r of rows) {
    out.push(`\n======== ${r.label} (${r.url}) ========`);
    out.push(`status=${r.status} ms=${r.ms} final=${r.finalUrl}`);
    if (r.info) {
      out.push(`title="${r.info.title}" overflowX=${r.info.overflowX} (${r.info.scrollW}/${r.info.clientW}) imgs=${r.info.imgCount} broken=${r.info.brokenImgs.length} noalt=${r.info.imgNoAlt} dialogs=${r.info.dialogs.length} skeletons=${r.info.skeletons}`);
      if (r.info.overflowers.length) out.push(`OVERFLOW: ${JSON.stringify(r.info.overflowers)}`);
      if (r.info.tinyTargets.length) out.push(`TINY TARGETS: ${JSON.stringify(r.info.tinyTargets)}`);
      if (r.info.inputsWithoutLabel.length) out.push(`INPUT SEM LABEL: ${JSON.stringify(r.info.inputsWithoutLabel)}`);
      if (r.info.brokenImgs.length) out.push(`BROKEN IMGS: ${JSON.stringify(r.info.brokenImgs)}`);
      out.push(`TEXT:\n${r.info.text.slice(0, 2000)}`);
      out.push(`BTNS: ${JSON.stringify([...new Set(r.info.btns)].slice(0, 40))}`);
      out.push(`LINKS: ${JSON.stringify([...new Set(r.info.links)].slice(0, 40))}`);
      if (r.info.inputs.length) out.push(`INPUTS: ${JSON.stringify(r.info.inputs)}`);
      if (r.info.tables.length) out.push(`TABLES: ${JSON.stringify(r.info.tables)}`);
    }
    if (r.bag.console.length) out.push(`CONSOLE: ${JSON.stringify(r.bag.console, null, 1)}`);
    if (r.bag.net.length) out.push(`NET: ${JSON.stringify(r.bag.net, null, 1)}`);
    if (r.bag.api.length) out.push(`API: ${JSON.stringify(r.bag.api)}`);
  }
  const txt = out.join("\n");
  console.log(txt);
  return txt;
}

/** Faz login e devolve o storageState para reutilizar. */
export async function login(ctx, email = LOGIN.email, pass = LOGIN.pass, url = "/login") {
  const context = await ctx.browser().newContext({ viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await context.newPage();
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  const finalUrl = page.url();
  const text = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 800);
  await page.screenshot({ path: path.join(OUT, "auth-login-result.png"), fullPage: true, scale: "css" });
  const state = await context.storageState();
  await page.close();
  await context.close();
  return { finalUrl, text, state };
}

export function save(name, data) {
  fs.writeFileSync(`qa/out/${name}.json`, JSON.stringify(data, null, 2));
}
