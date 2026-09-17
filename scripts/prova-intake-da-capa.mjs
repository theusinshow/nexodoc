// ANEXAR O MEMORIAL E LER A MENSAGEM DO CHAT: os dados vêm da capa.
//
//   npm run dev                                  (noutro terminal)
//   MEMORIAL=/caminho/027_24_md_geral_a.pdf node scripts/prova-intake-da-capa.mjs
//   (== npm run prova:intake-da-capa)
//
// 17/09/2026: o 027_24 (São José) chegava ao chat como "• Diário de Obra Em Dia"
// e "PREFEITURA MUNICIPAL DE SÃO JOSÉ SECRETARIA MUNICIPAL DE INFRAEST". Esta
// prova anexa o arquivo de verdade e lê a frase na tela.
//
// Sem IA: a classificação do anexo é determinística. O memorial vai pelo input
// `accept="application/pdf,image/*"`, que é o caminho dos anexos (ver
// nexodoc-pre-voo-do-anexo). A conversa criada fica no banco de dev.
import { chromium } from "playwright";
import { existsSync } from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const MEMORIAL = process.env.MEMORIAL;
let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};
if (!MEMORIAL || !existsSync(MEMORIAL)) {
  console.error("defina MEMORIAL com o caminho do PDF");
  process.exit(1);
}

const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  const pg = await ctx.newPage();
  await pularTourGuiado(pg);
  await pg.goto("/nexo", { waitUntil: "domcontentloaded" });
  if (pg.url().includes("/login")) {
    await pg.getByRole("button", { name: /Entrar como dev/i }).click();
    await pg.waitForURL("**/nexo**", { timeout: 60_000 });
  }
  await pg.waitForLoadState("networkidle");

  await pg
    .locator('input[type=file][accept="application/pdf,image/*"]')
    .first()
    .setInputFiles(MEMORIAL);
  // A abertura é contrato da bateria; os dados depois dela é que vêm da capa.
  const mensagem = pg.getByText(/Li as primeiras páginas: é o memorial descritivo/).first();
  await mensagem.waitFor({ state: "visible", timeout: 180_000 }).catch(() => {});
  const texto = (await mensagem.textContent().catch(() => "")) ?? "";
  check("a mensagem de leitura apareceu", texto.length > 0);
  check(
    "com a obra da capa",
    texto.includes("BEIRA MAR DE SÃO JOSÉ - BARREIROS URBANIZAÇÃO DA ORLA - PARQUE, RESTAURANTE E LANCHONETE"),
    texto.slice(0, 300),
  );
  check(
    "com a prefeitura sem a secretaria colada",
    texto.includes("PREFEITURA MUNICIPAL DE SÃO JOSÉ · SECRETARIA MUNICIPAL DE INFRAESTRUTURA ·"),
    texto,
  );
  check("com o código", texto.includes("código 027-24"), texto);
  check("com o mês/ano", texto.includes("OUTUBRO 2025"), texto);
  check("e sem a prosa do canteiro", !texto.includes("Diário de Obra"), texto);

  await mensagem.scrollIntoViewIfNeeded().catch(() => {});
  const caixa = await mensagem.boundingBox().catch(() => null);
  const janela = pg.viewportSize();
  check(
    "a mensagem está DENTRO da janela",
    Boolean(caixa) &&
      caixa.x >= 0 &&
      caixa.y >= 0 &&
      caixa.x + caixa.width <= janela.width &&
      caixa.y + caixa.height <= janela.height,
    JSON.stringify({ caixa, janela }),
  );
  await pg.screenshot({ path: "docs/provas/prova-intake-da-capa.png" }).catch(() => {});
} finally {
  await navegador.close();
}
console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
