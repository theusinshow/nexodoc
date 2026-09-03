/**
 * PROVA no navegador: o anexo indeciso aparece, o lote continua, e a escolha
 * resolve.
 *
 * NÃO GASTA MODELO. Os arquivos são um memorial do kit de erros plantados —
 * cujo NOME diz "capa" — e uma capa de volume de verdade. A prova para antes de
 * mandar auditar: o que se prova aqui é o ROTEAMENTO, não a auditoria.
 *
 * Por que existe, se já há `prova:pre-voo-real`: aquela prova o `preVoar` em
 * `node`. Esta prova o que nenhuma outra alcança — que o chip aparece, que ele
 * está DENTRO da janela, que os dois botões cabem na mesma linha, e que o resto
 * do lote andou com a pergunta aberta.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * DUAS PEDRAS QUE CUSTARAM TEMPO, e ficam anotadas porque a próxima prova de
 * tela vai tropeçar nas mesmas:
 *
 * 1. HÁ TRÊS `input[type=file]` no `/nexo`, e eles vão para funções
 *    DIFERENTES: `accept="application/pdf"` é o `addFiles` da tela de entrada,
 *    o sem `accept` é a pasta inteira, e o do COMPOSER — o que dispara o
 *    caminho dos anexos — é `accept="application/pdf,image/*"`. Pegar o
 *    primeiro faz a prova encher outro fluxo e não acusar nada.
 * 2. O TOUR DE BOAS-VINDAS (11 passos) abre por cima e come o clique.
 *
 *   npm run prova:pre-voo-navegador
 *   NEXODOC_BASE_URL=http://localhost:3100 npm run prova:pre-voo-navegador
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";

const BASE = process.env.NEXODOC_BASE_URL ?? "http://localhost:3000";

/**
 * O memorial cujo nome mente. Vive numa pasta IGNORADA pelo git
 * (`docs/samples/_auditoria-teste/`) — recriar com
 * `node scripts/gera-memoriais-defeituosos.mjs`.
 */
const MEMORIAL_MAL_NOMEADO = "docs/samples/_auditoria-teste/01-identidade-capa-x-corpo.pdf";
/** Capa de volume real: uma folha, e o fluxo de prancha é o lugar dela. */
const CAPA =
  "docs/samples/040-26/10_his_inc_spd/arquivos separados/040_26_capa_vol10_his_inc_spd_a.pdf";

for (const p of [MEMORIAL_MAL_NOMEADO, CAPA]) {
  if (!existsSync(p)) {
    console.error(`FALTA o arquivo ${p} — a prova não roda sem ele.`);
    process.exit(1);
  }
}

let passou = 0;
function check(nome, cond, detalhe = "") {
  if (cond) {
    passou += 1;
    console.log(`  ok  ${nome}`);
  } else {
    console.error(`FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
    process.exitCode = 1;
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

/** O console conta o que a tela esconde — ver o `[pre-voo]` em `preVoar`. */
const avisos = [];
page.on("console", (m) => {
  if (m.text().includes("[pre-voo]")) avisos.push(m.text());
});

try {
  await entrarComo(page, "milton@prosul.com.br");
  await page.goto("/nexo");
  await page.waitForLoadState("networkidle");

  const pular = page.getByRole("button", { name: /pular/i }).first();
  if (await pular.count()) {
    await pular.click();
    await page.waitForTimeout(400);
  }

  // Os DOIS de uma vez: o indeciso não pode segurar a capa.
  await page
    .locator('input[accept="application/pdf,image/*"]')
    .setInputFiles([MEMORIAL_MAL_NOMEADO, CAPA]);

  const indeciso = page.getByText("memorial ou prancha?", { exact: false }).first();
  await indeciso.waitFor({ state: "visible", timeout: 60000 });
  check("o chip indeciso aparece", await indeciso.isVisible());

  /*
   * VISÍVEL DE VERDADE. Asserção de DOM passa verde com o elemento fora da
   * tela — a régua é a caixa contra a janela.
   */
  const caixa = await indeciso.boundingBox();
  const janela = page.viewportSize();
  check(
    "o chip está DENTRO da janela",
    Boolean(caixa) &&
      caixa.x >= 0 &&
      caixa.y >= 0 &&
      caixa.x + caixa.width <= janela.width &&
      caixa.y + caixa.height <= janela.height,
    JSON.stringify(caixa),
  );

  const titulo = await indeciso.getAttribute("title");
  check(
    "o chip diz POR QUE está em dúvida, com o número medido",
    Boolean(titulo) && /\d+\s+folhas/i.test(titulo),
    titulo ?? "(sem title)",
  );

  /*
   * A MEDIÇÃO ACONTECEU DE VERDADE. Se o pdf.js falhasse, `preVoar` cairia
   * para o nome do arquivo e deixaria um `[pre-voo]` no console — e o nome
   * deste arquivo diz "capa", então o chip indeciso nem existiria. Esta linha
   * pega o caso inverso: chip por acaso, medição quebrada.
   */
  check("nenhum aviso de falha de medição no console", avisos.length === 0, avisos.join(" | "));

  // Os dois botões, e na MESMA linha (o painel estreito do Nexo quebra fácil).
  const botaoMemorial = page.getByRole("button", { name: "tratar como memorial" }).first();
  const botaoPrancha = page.getByRole("button", { name: "tratar como prancha" }).first();
  await botaoMemorial.waitFor({ state: "visible", timeout: 15000 });
  const cxM = await botaoMemorial.boundingBox();
  const cxP = await botaoPrancha.boundingBox();
  check(
    "os dois botões aparecem, e na mesma linha",
    Boolean(cxM && cxP) && Math.abs(cxM.y - cxP.y) < 4,
    `y memorial=${cxM?.y} y prancha=${cxP?.y}`,
  );

  /*
   * O LOTE NÃO PAROU. A capa do mesmo envio tem que ter sido roteada enquanto
   * a pergunta segue aberta — é essa a promessa do desenho. Ela aparece como
   * chip próprio, e SEM a tarja de dúvida: o papel dela foi decidido.
   */
  const chipDaCapa = page.getByText("040_26_capa_vol10_his_inc_spd_a.pdf").first();
  await chipDaCapa.waitFor({ state: "visible", timeout: 60000 });
  check(
    "a capa do mesmo lote foi decidida, com a pergunta ainda aberta",
    (await chipDaCapa.isVisible()) && (await indeciso.isVisible()),
  );
  check(
    "a pergunta é de UM anexo só, não do lote",
    (await page.getByText("memorial ou prancha?", { exact: false }).count()) === 1,
  );

  /*
   * A CONVERSA NOMEIA QUEM ESPERA. O chip é a tela; a frase é o que faz alguém
   * olhar o chip num lote de oito.
   */
  const recado = page.getByText(/Não consegui decidir se/).first();
  await recado.waitFor({ state: "visible", timeout: 30000 });
  const textoDoRecado = await recado.innerText();
  check(
    "a conversa nomeia o arquivo indeciso e diz o motivo",
    textoDoRecado.includes("01-identidade-capa-x-corpo.pdf") && /67 folhas/.test(textoDoRecado),
    textoDoRecado.slice(0, 160),
  );

  mkdirSync("docs/provas", { recursive: true });
  await page.screenshot({ path: "docs/provas/pre-voo-do-anexo.png" });

  // Escolher apaga a dúvida.
  await botaoMemorial.click();
  await indeciso.waitFor({ state: "detached", timeout: 60000 });
  check("escolher apaga a dúvida", true);
} finally {
  await browser.close();
}

console.log(`\n${passou} verificação(ões) de pré-voo no navegador OK`);
console.log("captura: docs/provas/pre-voo-do-anexo.png");
