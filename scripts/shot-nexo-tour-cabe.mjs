// O BALÃO DO TOUR CABE NA TELA, em todos os passos.
//
// O onboarding é superfície de lançamento: um balão que vaza pela borda numa
// tela menor é a primeira coisa que alguém vê do produto. A geometria
// (`posicao-do-balao.ts`) tem teste puro; o que ela NÃO cobre é a altura real
// do balão de cada passo, que depende do texto.
//
//   npm run dev                       (noutro terminal)
//   node scripts/shot-nexo-tour-cabe.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-tour";
fs.mkdirSync(OUT, { recursive: true });

/** Duas larguras: a folgada e a do notebook, onde a conta aperta. */
const TELAS = [
  ["larga", { width: 1600, height: 1000 }],
  ["notebook", { width: 1280, height: 800 }],
];

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();

for (const [nomeTela, viewport] of TELAS) {
  console.log(`\n=== ${nomeTela} (${viewport.width}x${viewport.height}) ===`);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
    if (page.url().includes("/login")) {
      await page.getByRole("button", { name: /Entrar como dev/i }).click();
      await page.waitForURL("**/nexo**", { timeout: 30000 });
    }
    // O tour só aparece para quem nunca o viu: limpamos a marca e recarregamos.
    await page.evaluate(() => window.localStorage.removeItem("nexo:tour-visto"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const balao = page.locator("[data-tour-balao]").first();
    await balao.waitFor({ timeout: 15000 });

    for (let passo = 1; passo <= 12; passo++) {
      await page.waitForTimeout(450);
      const caixa = await balao.boundingBox();
      const texto = (await balao.innerText()).replace(/\s+/g, " ").slice(0, 46);
      const dentro =
        caixa !== null &&
        caixa.x >= -1 &&
        caixa.y >= -1 &&
        caixa.x + caixa.width <= viewport.width + 1 &&
        caixa.y + caixa.height <= viewport.height + 1;

      check(
        `passo ${passo} cabe na tela — "${texto}…"`,
        dentro,
        JSON.stringify({ caixa, viewport }),
      );
      if (!dentro) {
        await page.screenshot({ path: `${OUT}/vazou-${nomeTela}-p${passo}.png` });
      }

      const proximo = page.getByRole("button", { name: /Pr[óo]ximo|Come[çc]ar|Entendi/i });
      if ((await proximo.count()) === 0) break;
      await proximo.first().click();
      if ((await balao.count()) === 0) break;
    }

    await page.screenshot({ path: `${OUT}/fim-${nomeTela}.png` });
  } catch (err) {
    falhas++;
    console.error("FALHOU (exceção):", err instanceof Error ? err.message : err);
    await page.screenshot({ path: `${OUT}/erro-${nomeTela}.png` }).catch(() => {});
  } finally {
    await context.close();
  }
}

await browser.close();
console.log(
  falhas === 0 ? `\nTudo OK. Prints em ${OUT}` : `\n${falhas} checagem(ns) falharam. Prints em ${OUT}`,
);
process.exit(falhas === 0 ? 0 : 1);
