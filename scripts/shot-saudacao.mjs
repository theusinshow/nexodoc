// A ENTRADA: a frase se escrevendo, o orbe falando junto — e a prova de que a
// hora não quebra a hidratação.
//
// Esse último ponto é o motivo de o teste existir: a saudação depende do relógio
// do NAVEGADOR, e o HTML é escrito no servidor. Ler a hora no render faria o
// servidor mandar "Boa noite" e o cliente hidratar "Boa tarde" — o React derruba
// a árvore e o console acusa. Aqui o console é lido junto com a tela.
//
//   npm run dev                    (noutro terminal)
//   node scripts/shot-saudacao.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-saudacao";
fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();

/** Abre o Nexo com um fuso/relógio fixo e devolve a frase que apareceu. */
async function comRelogio(iso, rotulo) {
  const context = await browser.newContext({
    viewport: { width: 1500, height: 950 },
    deviceScaleFactor: 2,
    // O relógio do navegador é fixado: sem isto o teste diria coisas diferentes
    // conforme a hora em que alguém o roda.
    locale: "pt-BR",
  });
  await context.addInitScript(`{
    const fixo = new Date(${JSON.stringify(iso)}).getTime();
    const Real = Date;
    // Só o "agora" é fixado; o resto do Date continua funcionando.
    class Falso extends Real {
      constructor(...args) { super(...(args.length ? args : [fixo])); }
      static now() { return fixo; }
    }
    globalThis.Date = Falso;
  }`);
  const page = await context.newPage();
  const problemas = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/hydrat|did not match|Text content does not match/i.test(t)) problemas.push(t);
  });
  page.on("pageerror", (e) => problemas.push(String(e)));

  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }

  // No meio da escrita: é aqui que se vê que ela é escrita, e não colada.
  await page.waitForTimeout(900);
  const meio = (await page.locator("h2").first().innerText()).trim();
  await page.screenshot({ path: `${OUT}/${rotulo}-1-escrevendo.png` });

  await page.waitForTimeout(2500);
  const fim = (await page.locator("h2").first().innerText()).trim();
  await page.screenshot({ path: `${OUT}/${rotulo}-2-pronta.png` });

  await context.close();
  return { meio, fim, problemas };
}

try {
  console.log("\nManhã (09:20)");
  const manha = await comRelogio("2026-08-03T09:20:00", "manha");
  check("cumprimenta com BOM DIA", manha.fim.startsWith("Bom dia"), manha.fim);
  check(
    "a frase é ESCRITA (no meio do caminho ela ainda está incompleta)",
    manha.meio.length > 0 && manha.meio.length < manha.fim.length,
    `meio: "${manha.meio}" · fim: "${manha.fim}"`,
  );
  check("termina perguntando o que fazer", /montar/.test(manha.fim) && /auditar/.test(manha.fim), manha.fim);
  check("nenhum erro de hidratação", manha.problemas.length === 0, manha.problemas[0] ?? "");

  console.log("\nTarde (14:05)");
  const tarde = await comRelogio("2026-08-03T14:05:00", "tarde");
  check("cumprimenta com BOA TARDE", tarde.fim.startsWith("Boa tarde"), tarde.fim);
  check("nenhum erro de hidratação", tarde.problemas.length === 0, tarde.problemas[0] ?? "");

  console.log("\nNoite (21:40)");
  const noite = await comRelogio("2026-08-03T21:40:00", "noite");
  check("cumprimenta com BOA NOITE", noite.fim.startsWith("Boa noite"), noite.fim);
  check("nenhum erro de hidratação", noite.problemas.length === 0, noite.problemas[0] ?? "");

  console.log("\nMadrugada (03:10) — o plantão de entrega");
  const madruga = await comRelogio("2026-08-03T03:10:00", "madrugada");
  check("às 3h ainda é BOA NOITE", madruga.fim.startsWith("Boa noite"), madruga.fim);
} catch (err) {
  falhas++;
  console.error("FALHOU (exceção):", err instanceof Error ? err.message : err);
} finally {
  await browser.close();
}

console.log(
  falhas === 0 ? `\nTudo OK. Prints em ${OUT}` : `\n${falhas} checagem(ns) falharam. Prints em ${OUT}`,
);
process.exit(falhas === 0 ? 0 : 1);
