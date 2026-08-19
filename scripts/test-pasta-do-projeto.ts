/**
 * A PASTA DO PROJETO e o NOME DA CONVERSA. Núcleo puro → node cru.
 *
 *   node scripts/test-pasta-do-projeto.ts   (== npm run test:nexo:pasta)
 */
import assert from "node:assert/strict";

import { nomeDoVolume, pastaDoProjeto } from "../modules/nexo/lib/pasta-do-projeto.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("pasta do projeto\n");

test("código e prefeitura viram a pasta, com hífen", () => {
  assert.equal(pastaDoProjeto("084_25", "PREFEITURA MUNICIPAL DE CRICIÚMA"), "084-25-CRICIUMA");
  assert.equal(pastaDoProjeto("084-25", "Criciúma"), "084-25-CRICIUMA");
});

test("SEM PREFEITURA NÃO HÁ PASTA — nunca meio nome", () => {
  /*
   * Uma pasta "084-25" que amanhã vira "084-25-CRICIUMA" muda de identidade
   * debaixo de quem está usando, e quem já a abriu perde a referência. Fica em
   * "Sem pasta" até a prefeitura ser decidida — que é a MESMA decisão que a
   * capa e a separatriz esperam.
   */
  assert.equal(pastaDoProjeto("084_25", null), "");
  assert.equal(pastaDoProjeto("084_25", "  "), "");
});

test("sem código não há pasta", () => {
  assert.equal(pastaDoProjeto(null, "Criciúma"), "");
  assert.equal(pastaDoProjeto("", "Criciúma"), "");
});

test("memorial e volume do mesmo projeto dão a MESMA pasta", () => {
  // É por isso que a pasta existe: reunir os dois trabalhos do mesmo projeto.
  const doVolume = pastaDoProjeto("084_25", "PREFEITURA MUNICIPAL DE CRICIÚMA");
  const doMemorial = pastaDoProjeto("084-25", "Criciúma - SC");
  assert.equal(doVolume, doMemorial);
  assert.equal(doVolume, "084-25-CRICIUMA");
});

test("uma disciplina vira a sigla", () => {
  // O que chega é o CÓDIGO do carimbo ("met"), que é o que o nó do canvas já
  // mostra. Usar a mesma `siglaDaDisciplina` é o que mantém a barra lateral e o
  // canvas dizendo a MESMA coisa sobre a mesma folha.
  assert.equal(nomeDoVolume(["met"]), "MET");
});

test("volume misto lista as siglas, sem repetir e na ordem de entrada", () => {
  /*
   * O misto é o CASO COMUM: seis dos oito volumes reais do escritório misturam
   * disciplinas. Um nome que só funcionasse com uma estaria errado na maioria.
   */
  assert.equal(nomeDoVolume(["met", "his", "met", "inc"]), "MET · HIS · INC");
});

test("folha sem disciplina não entra no nome", () => {
  assert.equal(nomeDoVolume(["met", null, "", undefined]), "MET");
});

test("nome POR EXTENSO cai na família, e o canvas concorda", () => {
  /*
   * `siglaDaDisciplina` agrupa por FAMÍLIA DE COR quando reconhece a palavra:
   * "metalica" é da família estrutural, e vira EST. Não é o que o carimbo deste
   * escritório entrega (ele escreve "met"), mas se entregasse, a barra e o nó do
   * canvas diriam a mesma coisa — que é o que importa. Registrado para ninguém
   * se surpreender ao ver "EST" numa pasta de volume metálico.
   */
  assert.equal(nomeDoVolume(["metalica"]), "EST");
});

test("nenhuma disciplina devolve vazio", () => {
  assert.equal(nomeDoVolume([]), "");
  assert.equal(nomeDoVolume([null, ""]), "");
});

console.log(`\n${passed} teste(s) passaram.`);
