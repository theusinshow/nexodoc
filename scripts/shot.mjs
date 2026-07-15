// Screenshot da tela de auditoria via Playwright (contexto limpo, sem service worker).
// Loga como dev, carrega o demo (sem gastar token) e captura cada aba do resultado.
//   node scripts/shot.mjs
import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();

await page.goto(`${BASE}/audit`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL("**/audit**", { timeout: 20000 });
}
await page.waitForLoadState("networkidle").catch(() => {});

// carrega o demo (sem IA, sem token)
await page.getByRole("button", { name: /Ver demonstração|Demo local/i }).first().click();
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/audit-result.png`, fullPage: true });
console.log("ok: audit-result.png (Resumo)");

// abas do resultado (labels únicos: Matriz/Evidências/Roteiro)
for (const label of ["Achados", "Relatório"]) {
  try {
    const btn = page.getByRole("button", { name: label, exact: true });
    await btn.last().click({ timeout: 5000 });
    await page.waitForTimeout(900);
    const file = `audit-${label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}.png`;
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
    console.log(`ok: ${file}`);
  } catch (error) {
    console.log(`skip ${label}: ${String(error).slice(0, 80)}`);
  }
}

await browser.close();
