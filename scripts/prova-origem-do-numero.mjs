// DE ONDE VEIO ESTE NUMERO — a proveniencia na tela.
//
//   node scripts/prova-origem-do-numero.mjs   (== npm run prova:origem)
//
// A precedencia e a deducao da origem sao provadas sem navegador
// (`npm run test:origem`). Aqui se mede o que so a tela responde: a explicacao
// chega ao no, e o NUMERO DEDUZIDO PELA ORDEM — o unico que ninguem leu — ganha
// marca visivel, enquanto os lidos ficam so no hover.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";
import { semearCanvas } from "./lib/semear-canvas.mjs";

nextEnv.loadEnvConfig(process.cwd());

const BASE =
  process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};

/*
 * DUAS folhas com nome proprio (origem = nome do arquivo) e TRES vindas do
 * MESMO PDF com o mesmo numero no carimbo — que e o caso real do volume
 * escaneado inteiro. Nessas tres a reconciliacao por ordem entra, e e nelas que
 * a marca precisa aparecer.
 */
const FOLHAS = [
  { disciplina: "Arquitetura", folha: 1, conteudo: "Planta baixa" },
  { disciplina: "Arquitetura", folha: 2, conteudo: "Cortes e fachadas" },
  {
    disciplina: "Estrutural",
    folha: 1,
    conteudo: "Formas",
    arquivoDoUpload: "vol_est.pdf",
    pagina: 1,
  },
  {
    disciplina: "Estrutural",
    folha: 1,
    conteudo: "Armacao",
    arquivoDoUpload: "vol_est.pdf",
    pagina: 2,
  },
  {
    disciplina: "Estrutural",
    folha: 1,
    conteudo: "Detalhes",
    arquivoDoUpload: "vol_est.pdf",
    pagina: 3,
  },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1500, height: 900 },
});
const page = await ctx.newPage();
page.setDefaultTimeout(25000);
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

await entrarComo(page, "victor@prosul.com");
await page.goto("/nexo");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);
const pular = page.getByRole("button", { name: /pular/i });
if (await pular.count()) await pular.first().click();
await page.waitForTimeout(600);

await semearCanvas(page, {
  conversationId: "qa-origem-do-numero",
  titulo: "QA ORIGEM DO NUMERO",
  folhas: FOLHAS,
});

const nos = page.locator(".react-flow__node-folha");
check(
  "as cinco folhas estao no canvas",
  (await nos.count()) === 5,
  `${await nos.count()}`,
);

// A explicação chega ao nó, em palavras — o `title` custa zero pixel e responde
// a pergunta inteira.
const titulos = await nos.evaluateAll((ns) =>
  ns.map((n) => n.querySelector("span[title]")?.getAttribute("title") ?? null),
);
check(
  "todo numero carrega a explicacao da origem",
  titulos.every((t) => typeof t === "string" && t.length > 0),
  JSON.stringify(titulos),
);
check(
  "as folhas de nome proprio dizem que vieram do NOME do arquivo",
  titulos.filter((t) => /nome do arquivo/i.test(t ?? "")).length === 2,
  JSON.stringify(titulos),
);
check(
  "e as do PDF combinado dizem que foram deduzidas pela ORDEM",
  titulos.filter((t) => /ordem das p[áa]ginas/i.test(t ?? "")).length === 2,
  JSON.stringify(titulos),
);
check(
  "a explicacao da ordem diz, com todas as letras, que ninguem leu",
  titulos.some((t) => /ningu[ée]m o leu/i.test(t ?? "")),
  JSON.stringify(titulos),
);

// A MARCA visível é só do número deduzido: marcar as quatro origens encheria o
// nó de pontos e apagaria o único que muda o que se faz.
const marcas = page.locator(
  '[aria-label="número deduzido pela ordem das páginas"]',
);
check(
  "so o numero deduzido ganha marca visivel",
  (await marcas.count()) === 2,
  `${await marcas.count()}`,
);

check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));

await page.screenshot({
  path: `${process.env.SHOT_DIR ?? "."}/origem-do-numero.png`,
});
await browser.close();
console.log(falhas === 0 ? "\nPROVA DA ORIGEM OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
