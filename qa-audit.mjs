// QA harness: navega rotas, captura console/network/screenshots.
// uso: node qa-audit.mjs <plan>
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:3210";
const OUT = "qa-screenshots";
export { BASE };
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

export async function launch() {
  fs.mkdirSync(OUT, { recursive: true });
  // --disable-gpu: GPU process na iGPU de 2011 destabiliza o notebook
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
  return browser;
}

export function attach(page, bag, { label = "page" } = {}) {
  page.on("console", (m) => {
    const t = m.type();
    if (t === "error" || t === "warning") bag.console.push({ page: label, type: t, text: m.text().slice(0, 400) });
  });
  page.on("pageerror", (e) => bag.console.push({ page: label, type: "pageerror", text: String(e).slice(0, 400) }));
  page.on("requestfailed", (r) => bag.net.push({ page: label, url: r.url(), status: "FAILED", err: r.failure()?.errorText }));
  page.on("response", async (r) => {
    const u = r.url();
    if (r.status() >= 400) bag.net.push({ page: label, url: u, status: r.status() });
    if (u.includes("/api/")) bag.api.push({ page: label, method: r.request().method(), url: u, status: r.status() });
  });
}

export async function visit(ctx, url, label, { viewport = "desktop", shot = true, full = false, wait = 1500, extra = null } = {}) {
  const page = await ctx.newPage();
  await page.setViewportSize(VIEWPORTS[viewport]);
  const bag = { console: [], net: [], api: [] };
  attach(page, bag, { label });
  const t0 = Date.now();
  let status = null;
  try {
    const resp = await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 45000 });
    status = resp?.status();
    await page.waitForTimeout(wait);
  } catch (e) {
    bag.console.push({ page: label, type: "navigation", text: String(e).slice(0, 300) });
  }
  const ms = Date.now() - t0;
  if (shot) await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: full, scale: "css" }).catch(() => {});
  const info = await page.evaluate(() => {    const de = document.documentElement;
    return {
      title: document.title,
      text: (document.body?.innerText || "").slice(0, 4000),
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      scrollH: de.scrollHeight,
      overflowX: de.scrollWidth > de.clientWidth + 1,
      brokenImgs: Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
      imgs: Array.from(document.images).map((i) => ({ src: (i.currentSrc || i.src).slice(-90), nw: i.naturalWidth, alt: i.alt })),
      btns: Array.from(document.querySelectorAll("button")).length,
      links: Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")).slice(0, 60),
      inputs: Array.from(document.querySelectorAll("input,textarea,select")).map((i) => ({
        type: i.type || i.tagName, name: i.name || null, id: i.id || null, ph: i.placeholder || null,
        label: i.labels?.[0]?.innerText?.trim() || null, aria: i.getAttribute("aria-label"), required: i.required,
      })),
      emptyStates: Array.from(document.querySelectorAll("main *")).length,
    };
  }).catch(() => null);
  await page.close();
  return { label, url, status, ms, bag, info };
}

export function report(rows) {
  for (const r of rows) {
    console.log("\n================ " + r.label + " (" + r.url + ") ================");
    console.log("status=" + r.status + " ms=" + r.ms);
    if (r.info) {
      console.log("title:", r.info.title, "| overflowX:", r.info.overflowX, `(${r.info.scrollW} vs ${r.info.clientW})`, "| btns:", r.info.btns);
      console.log("TEXT:\n" + r.info.text.slice(0, 1800));
      if (r.info.brokenImgs.length) console.log("BROKEN IMGS:", r.info.brokenImgs);
      if (r.info.links.length) console.log("LINKS:", [...new Set(r.info.links)].join(", "));
      console.log("INPUTS:", JSON.stringify(r.info.inputs));
    }
    if (r.bag.console.length) console.log("CONSOLE:", JSON.stringify(r.bag.console, null, 1));
    if (r.bag.net.length) console.log("NET ISSUES:", JSON.stringify(r.bag.net, null, 1));
    if (r.bag.api.length) console.log("API:", JSON.stringify(r.bag.api));
  }
}
