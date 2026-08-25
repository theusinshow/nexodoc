/**
 * A ANCORAGEM RECONHECE A TRANSCRIÇÃO CORRETA — E RECUSA A INVENTADA.
 *
 * Os casos vêm do 117_25: carimbo de rodapé no meio da frase, elisão com
 * `[...]`, e frase que atravessa a virada de página. Os três são situações em
 * que um medidor ingênuo acusaria de invenção quem transcreveu certo — e errar
 * nessa direção é pior que não medir, porque destrói a confiança no achado
 * justamente por um defeito do medidor.
 *
 *   node scripts/test-ancoragem.ts  (== npm run test:ancoragem)
 */
import assert from "node:assert/strict";

import {
  ancorarEvidencia,
  ancorarTrecho,
  esqueleto,
  esqueletoComMapa,
  indexarParaAncoragem,
  paginasDe,
  trechosCitados,
} from "../lib/ancoragem-de-evidencia.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

/** Rodapé igual ao do memorial real, com o número variando por página. */
const rodape = (n: number) =>
  `PREFEITURA MUNICIPAL DE PALHOCA Cap.7 - Pag.${n} Direitos Autorais Reservados`;
const pagina = (n: number, corpo: string) => ({
  page: n,
  text: `${rodape(n)} ${corpo} ${rodape(n)}`,
});

const paginas = [
  pagina(60, "As alvenarias serao executadas em blocos ceramicos de vedacao."),
  pagina(61, "Para melhor amarracao com a alvenaria"),
  pagina(62, "existente, evitando fissuras na interface entre os materiais."),
  pagina(63, "As portas de vidro temperado deverao receber sinalizacao visual."),
  pagina(64, "Ramal de ligacao aereo: Aluminio multiplexado de # 35m2."),
];
const indice = indexarParaAncoragem(paginas);

test("esqueleto ignora acento, caixa e refluxo de espaco", () => {
  assert.equal(esqueleto("UBS  Paraíso – Porte 1"), esqueleto("ubs paraiso - porte 1"));
});

test("o carimbo repetido em toda pagina e detectado e removido", () => {
  assert.ok(indice.nInicio > 0, "prefixo comum nao detectado");
  assert.ok(indice.nFim > 0, "sufixo comum nao detectado");
});

test("frase que atravessa a virada de pagina ancora na faixa declarada", () => {
  // Só ancora porque o carimbo saiu do meio: com ele, "alvenariaexistente"
  // nunca aparece contíguo.
  const v = ancorarTrecho(indice, "melhor amarracao com a alvenaria existente", [61, 62]);
  assert.equal(v, "ancorada");
});

test("elisao com [...] e procurada em pedacos", () => {
  const v = ancorarTrecho(indice, "As portas de vidro [...] deverao receber sinalizacao", [63]);
  assert.equal(v, "ancorada");
});

test("trecho que existe em OUTRA pagina nao passa por ancorado", () => {
  const v = ancorarTrecho(indice, "blocos ceramicos de vedacao", [63]);
  assert.equal(v, "outra_pagina");
});

test("trecho que nao existe no documento e recusado", () => {
  const v = ancorarTrecho(indice, "impermeabilizacao com manta asfaltica de 4mm", [60]);
  assert.equal(v, "nao_encontrada");
});

test("evidencia sem transcricao nenhuma e reportada como tal", () => {
  const r = ancorarEvidencia(indice, "p. 60:", 60);
  assert.equal(r.veredito, "sem_transcricao");
});

test("evidencia com aspas usa o que esta entre elas", () => {
  const r = ancorarEvidencia(indice, 'Pagina 64: "Aluminio multiplexado de # 35m2"', "64");
  assert.equal(r.veredito, "ancorada");
  assert.ok(r.trecho.includes("multiplexado"));
});

test("trechosCitados prefere as aspas e cai no resto sem elas", () => {
  assert.deepEqual(trechosCitados('x "uma transcricao longa aqui" y'), ["uma transcricao longa aqui"]);
  assert.deepEqual(trechosCitados("Pagina 57: uma transcricao sem aspas"), ["uma transcricao sem aspas"]);
});

test("paginasDe expande faixa e nao perde numero solto", () => {
  assert.deepEqual(paginasDe("159-161"), [159, 160, 161]);
  assert.deepEqual(
    paginasDe("17 e 21").sort((a, b) => a - b),
    [17, 21],
  );
});

test("esqueletoComMapa devolve o MESMO esqueleto que esqueleto()", () => {
  // Duas normalizacoes que divergem em silencio sao o defeito que esta
  // biblioteca existe para evitar. Aqui elas sao casadas.
  const casos = [
    "MÉTRICA de execução — 1,20m²",
    "Ramal de ligação aéreo: Alumínio multiplexado de # 35m²",
    "PREFEITURA  MUNICIPAL\nDE  PALHOÇA",
  ];
  for (const caso of casos) {
    assert.equal(esqueletoComMapa(caso).skeleton, esqueleto(caso), caso);
  }
});

test("o indice do mapa aponta para o texto ORIGINAL, com acento", () => {
  const texto = "A MÉTRICA de execução é a área líquida.";
  const { skeleton, indices } = esqueletoComMapa(texto);
  const de = skeleton.indexOf("area");
  assert.notEqual(de, -1);
  // Recortando pelo indice, o original volta ACENTUADO -- e e o que o
  // engenheiro vai encontrar quando abrir o PDF para conferir.
  assert.equal(texto.slice(indices[de], indices[de] + 4), "área");
});

console.log(`\n${passed} teste(s) de ancoragem OK`);
