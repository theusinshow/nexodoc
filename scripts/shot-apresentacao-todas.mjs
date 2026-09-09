// TODAS AS FOLHAS, COM A COREOGRAFIA COMPLETA — 09/09/2026.
//
// Captura as 19 folhas do deck e as 6 do anexo depois de ESPERA ms (5,2 s por
// padrão: a folha 05 leva ~4,3 s até o cartão chegar), mais um quadro no meio
// da troca 02→03 para provar o crossfade. Com REDUZIDO=1 emula
// prefers-reduced-motion e grava em outra pasta: toda folha precisa estar
// inteira sem animação nenhuma.
//
//   npm run dev                                   (noutro terminal)
//   node scripts/shot-apresentacao-todas.mjs
//   REDUZIDO=1 node scripts/shot-apresentacao-todas.mjs
//
// NÃO GASTA TOKEN: só desenha telas que já existem.
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const ESPERA = Number(process.env.ESPERA ?? 5200);
const REDUZIDO = process.env.REDUZIDO === "1";
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1600, height: 1000 },
  reducedMotion: REDUZIDO ? "reduce" : "no-preference",
});
const p = await ctx.newPage();
await p.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (p.url().includes("/login")) {
  await p.getByRole("button", { name: /Entrar como dev/i }).click();
  await p.waitForURL("**/nexo**");
}
const pasta = REDUZIDO
  ? "scratchpad/qa/apresentacao-reduzido"
  : "scratchpad/qa/apresentacao";
mkdirSync(pasta, { recursive: true });
for (const [rota, n, prefixo] of [
  ["/apresentacao", 19, "d"],
  ["/apresentacao/valores", 6, "v"],
]) {
  await p.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(800);
  for (let i = 1; i <= n; i++) {
    if (i > 1) {
      await p.keyboard.press("ArrowRight");
      // um quadro no meio da troca: a folha anterior ainda saindo por cima da nova
      if (i === 3 && prefixo === "d") {
        await p.waitForTimeout(90);
        await p.screenshot({ path: `${pasta}/troca-02-03.png` });
      }
    }
    await p.waitForTimeout(ESPERA);
    await p.screenshot({
      path: `${pasta}/${prefixo}${String(i).padStart(2, "0")}.png`,
    });
  }
}
await b.close();
console.log("ok");
