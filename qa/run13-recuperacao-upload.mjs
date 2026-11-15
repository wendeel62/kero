// 12) Recuperação de senha + upload de imagem no cardápio.
import { launch, login, BASE, VIEWPORTS } from "./lib.mjs";
import fs from "fs";
import zlib from "zlib";

// PNG 1x1 gerado na hora (upload real via file chooser)
function png1x1() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  const idat = zlib.deflateSync(Buffer.from([0, 255, 0, 0]));
  const out = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
  return out;
}
let T = null;
function crc32(buf) {
  if (!T) { T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c; } }
  let c = 0xffffffff;
  for (const b of buf) c = T[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}
fs.writeFileSync("/tmp/opencode/qa-1x1.png", png1x1());

const browser = await launch();
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });

// ---- recuperação de senha ----
{
  const p = await ctx.newPage();
  const net = [];
  p.on("response", (r) => { if (r.url().includes("/api/") || r.request().method() === "POST") net.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 90)}`); });
  await p.goto(BASE + "/login/esqueci-senha", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.fill('input[type="email"]', "pizzaria123@gmail.com");
  await p.getByRole("button", { name: /Enviar/i }).click();
  await p.waitForTimeout(7000);
  console.log("[recupera senha] texto:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 400));
  console.log("[recupera senha] rede:", net.join(" | "));
  await p.screenshot({ path: "qa-screenshots/login-recuperacao-enviado.png", scale: "css" });
  // e-mail inválido
  await p.goto(BASE + "/login/esqueci-senha", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  await p.fill('input[type="email"]', "nao-existe@naoexiste.com");
  await p.getByRole("button", { name: /Enviar/i }).click();
  await p.waitForTimeout(6000);
  console.log("[recupera e-mail inexistente] texto:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 400));
  await p.close();
}

// ---- upload de imagem (cardápio → Novo Produto) ----
{
  const { state } = await login(ctx);
  const c2 = await browser.newContext({ storageState: state, viewport: VIEWPORTS.desktop, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await c2.newPage();
  const net = [];
  p.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 100)}`); });
  await p.goto(BASE + "/painel/cardapio", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 60; i++) { const t = await p.evaluate(() => document.body?.innerText ?? ""); if (t.includes("Categorias") && t.length > 200) break; await p.waitForTimeout(400); }
  await p.waitForTimeout(1500);
  await p.getByRole("tab", { name: /Produtos/ }).click();
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: /Novo Produto/i }).click();
  await p.waitForTimeout(2000);
  const file = p.locator('input[type="file"]').first();
  console.log("[upload] input file:", await file.count());
  if (await file.count()) {
    await file.setInputFiles("/tmp/opencode/qa-1x1.png");
    await p.waitForTimeout(6000);
    console.log("[upload] após enviar:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(-400));
    await p.screenshot({ path: "qa-screenshots/adm-cardapio-upload.png", fullPage: false, scale: "css" });
    const imgs = await p.evaluate(() => [...document.images].map(i => ({ src: (i.currentSrc || i.src).slice(-90), nw: i.naturalWidth })));
    console.log("[upload] imagens no modal:", JSON.stringify(imgs));
  }
  console.log("[upload] rede com erro:", net.join(" | ") || "(nenhum)");
  await p.close(); await c2.close();
}
await browser.close();
