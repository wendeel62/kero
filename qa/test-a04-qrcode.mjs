// Teste A-04: Cupom de impressão deve renderizar QR code local (não imagem quebrada)
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(`CONSOLE ${m.text().slice(0, 200)}`); });
page.on("pageerror", (e) => erros.push(`PAGEERROR ${String(e).slice(0, 200)}`));
const imgErros = [];
page.on("response", (r) => {
  if (r.url().includes("chart.googleapis.com")) {
    imgErros.push(`GOOGLE CHARTS ${r.status()} ${r.url().slice(0, 80)}`);
  }
});

// login como lojista
const context = await browser.newContext({ storageState: undefined });
// não há storage, vamos direto para a página de print de um pedido existente
// pedido entregue: 272d6fbe-6be0-4270-b3f7-7e65bf662769 (mas requer login)
// vamos acessar diretamente - deve redirecionar para login

await page.goto("http://localhost:3000/painel/pedidos/272d6fbe-6be0-4270-b3f7-7e65bf662769/print", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("url após redirect:", page.url().replace("http://localhost:3000", ""));
console.log("erros de console:", erros.length ? erros.join(" | ") : "nenhum");
console.log("requisições a Google Charts:", imgErros.length ? imgErros.join(" | ") : "nenhuma");

// Se redirect para login, faz login
if (page.url().includes("/login")) {
  await page.fill('input[type="email"]', "pizzaria123@gmail.com");
  await page.fill('input[type="password"]', "LojistaTest2026!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(7000);
  console.log("url após login:", page.url().replace("http://localhost:3000", ""));
  
  // tenta acessar o print novamente
  await page.goto("http://localhost:3000/painel/pedidos/272d6fbe-6be0-4270-b3f7-7e65bf662769/print", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("url final do print:", page.url().replace("http://localhost:3000", ""));
  
  const texto = await page.evaluate(() => document.body.innerText);
  console.log("texto do cupom (primeiros 500 chars):", texto.slice(0, 500));
  
  // verifica se o QR code img tem src válido (data URL ou https, não chart.googleapis.com)
  const qrImg = page.locator('img[alt="QR code do pedido"]');
  const qrCount = await qrImg.count();
  console.log(`imagens de QR code encontradas: ${qrCount}`);
  if (qrCount > 0) {
    const src = await qrImg.first().getAttribute("src");
    const ehDataUrl = src?.startsWith("data:") ?? false;
    const ehGoogleCharts = src?.includes("chart.googleapis.com") ?? false;
    console.log(`QR src começa com data: ${ehDataUrl}`);
    console.log(`QR src é Google Charts: ${ehGoogleCharts}`);
    if (ehDataUrl && !ehGoogleCharts) {
      console.log("RESULTADO: A-04 CORRIGIDO - QR code gerado localmente (data URL)");
    } else {
      console.log("RESULTADO: A-04 AINDA QUEBRADO - QR ainda usa Google Charts ou sem src");
    }
  }
  
  await page.screenshot({ path: "qa-screenshots/test-a04-qrcode.png", fullPage: true, scale: "css" });
}

await browser.close();
