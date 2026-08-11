/**
 * O quadro do criterio 06: /nexo a 1600 x 1000, do mesmo tamanho da 11a do
 * "Nexo - Redesenho.dc.html", para comparar corte a corte lado a lado.
 *
 * Confira nesta ordem: os CORTES (todo canto superior esquerdo e inferior
 * direito), o PESO DO CONTORNO (1px, mesma cor de borda em toda superficie) e a
 * TIPOGRAFIA (nenhum Geist -- o produto e IBM Plex).
 *
 * Nao gasta token.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL(/\/nexo/, { timeout: 30_000 }).catch(() => {});
}
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: "chanfro-nexo-1600x1000.png" });
await browser.close();
console.log("chanfro-nexo-1600x1000.png");
