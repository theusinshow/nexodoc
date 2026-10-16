/**
 * PROVA DO CORTE DOS TOMOS (16/10/2026) — build de produção, banco de dev, sem token.
 *
 *   NEXODOC_BASE=http://localhost:3100 node scripts/prova-corte-dos-tomos.mjs
 *
 * Na conversa "FND · EST" do 017-26 (4 FND + 24 EST: a disciplina pequena e a grande,
 * o caso que trouxe isto):
 *   1. a régua aparece com um rótulo por tomo;
 *   2. arrastar a 1ª marca 3 vãos à direita passa 3 folhas do tomo 2 para o 1;
 *   3. clicar numa célula abre um tomo ali;
 *   4. "Voltar ao automático" devolve a divisão de antes.
 * O `data` da conversa é guardado antes e restaurado no fim, byte a byte.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { chromium } from "playwright";

import { entrarSemTela, pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.NEXODOC_BASE ?? "http://localhost:3100";
const CONVERSA = process.env.NEXODOC_PROVA_CONVERSA ?? "d3e5a9bc-b8be-4b8b-9977-9adebd6de46d";
const SAIDA = path.join(process.cwd(), "tmp", "prova-corte-dos-tomos");
fs.mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
const confere = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FALHOU"}  ${msg}`);
  if (!ok) falhas++;
};

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, "")]),
);
if (!/nexodoc_dev/.test(env.DATABASE_URL ?? "")) throw new Error("A prova só roda no nexodoc_dev.");
const banco = new pg.Client({ connectionString: env.DATABASE_URL });
await banco.connect();
const antes = (await banco.query('SELECT data, "updatedAt" FROM "NexoConversation" WHERE id = $1', [CONVERSA])).rows[0];
if (!antes) throw new Error(`Conversa ${CONVERSA} não está no banco de dev.`);

const browser = await chromium.launch();
const contexto = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await entrarSemTela(contexto, BASE);
const page = await contexto.newPage();
await pularTourGuiado(page);
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

/** "Tomo 01 · 18 folhas" → [18, …] */
const contagens = async () =>
  page.locator(".nx-regua-tomo").evaluateAll((els) =>
    els.map((el) => Number(/^(\d+) folha/.exec(el.lastElementChild?.textContent ?? "")?.[1] ?? NaN)),
  );

try {
  await page.goto(`${BASE}/nexo?conversa=${CONVERSA}`);
  const regua = page.locator(".nx-regua");
  await regua.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SAIDA, "1-regua.png") });

  const inicio = await contagens();
  console.log(`      tomos no começo: ${JSON.stringify(inicio)}`);
  const celulas = await page.locator(".nx-regua-celula").count();
  confere(inicio.length >= 1 && inicio.reduce((a, b) => a + b, 0) === celulas, `a régua soma as ${celulas} folhas do canvas`);

  // Com um tomo só, o primeiro corte nasce de um clique (célula 10).
  if (inicio.length === 1) {
    await page.locator(".nx-regua-celula").nth(10).click();
    await page.waitForTimeout(600);
  }
  const base = await contagens();
  confere(base.length >= 2, `há corte para arrastar (${JSON.stringify(base)})`);

  // 2. arrastar a 1ª marca 3 vãos à direita
  const marca = page.locator(".nx-regua-marca").first();
  const trilho = await page.locator(".nx-regua-trilho").boundingBox();
  const caixa = await marca.boundingBox();
  const passo = trilho.width / celulas;
  const x0 = caixa.x + caixa.width / 2;
  const y0 = caixa.y + caixa.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(x0 + (3 * passo * k) / 6, y0);
  await page.screenshot({ path: path.join(SAIDA, "2-na-mao.png") });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const depois = await contagens();
  console.log(`      depois do arrasto: ${JSON.stringify(depois)}`);
  confere(depois[0] === base[0] + 3 && depois[1] === base[1] - 3, "3 folhas passaram do tomo 2 para o 1");
  await page.screenshot({ path: path.join(SAIDA, "3-arrastado.png") });

  // As fileiras do canvas seguem a régua: a 1ª fileira tem as folhas do tomo 1.
  const cabecalho = await page.locator("body").innerText();
  confere(new RegExp(`${depois[0]} folhas`).test(cabecalho), "o canvas mostra a contagem nova do tomo 1");

  // 3. clicar numa célula do último tomo abre um tomo ali
  const total = depois.reduce((a, b) => a + b, 0);
  await page.locator(".nx-regua-celula").nth(total - 3).click();
  await page.waitForTimeout(800);
  const comNovo = await contagens();
  console.log(`      com o tomo novo: ${JSON.stringify(comNovo)}`);
  confere(comNovo.length === depois.length + 1 && comNovo.at(-1) === 3, "clicar na célula abre um tomo com as 3 últimas");

  // 4. voltar ao automático
  await page.getByRole("button", { name: /Voltar ao automático/ }).click();
  await page.waitForTimeout(800);
  const deVolta = await contagens();
  console.log(`      de volta ao automático: ${JSON.stringify(deVolta)}`);
  confere(JSON.stringify(deVolta) === JSON.stringify(inicio), "voltar ao automático devolve a divisão do começo");
  await page.screenshot({ path: path.join(SAIDA, "4-automatico.png") });

  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  await banco.query('UPDATE "NexoConversation" SET data = $2, "updatedAt" = $3 WHERE id = $1', [
    CONVERSA,
    antes.data,
    antes.updatedAt,
  ]);
  await banco.end();
}

console.log(falhas === 0 ? "\nPROVA OK" : `\n${falhas} FALHA(S)`);
process.exitCode = falhas === 0 ? 0 : 1;
