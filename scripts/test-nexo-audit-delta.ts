/**
 * O COMPARATIVO DE CAPÍTULOS — o que decide se a auditoria incremental é viável.
 *
 * A pergunta que estes testes respondem: quando o memorial ganha um volume novo
 * no meio, os capítulos que NÃO mudaram continuam sendo reconhecidos como os
 * mesmos? Se a resposta fosse não, a etapa 2 (mandar ao modelo só o delta) não
 * teria em que se apoiar — e é melhor descobrir isso aqui do que numa
 * reauditoria de 258 segundos.
 *
 *   node scripts/test-nexo-audit-delta.ts   (== npm run test:nexo:audit-delta)
 */
import assert from "node:assert/strict";

import {
  compararImpressoes,
  fracaoJaLida,
  impressaoDosCapitulos,
  resumoDoDelta,
} from "../lib/audit-fingerprint.ts";
import type { AuditTextChunk } from "../lib/pdf-text.ts";

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

let n = 0;
const cap = (title: string, text: string, startPage = ++n): AuditTextChunk => ({
  id: `chunk-${n}`,
  title,
  startPage,
  endPage: startPage,
  text,
});

const ANTES = impressaoDosCapitulos([
  cap("1 GENERALIDADES", "O presente memorial descreve a obra.", 1),
  cap("2 ARQUITETURA", "Paredes em alvenaria de blocos ceramicos.", 8),
  cap("3 FUNDACOES", "Estacas escavadas com diametro de 40cm.", 20),
]);

test("documento intocado: tudo igual", () => {
  const d = compararImpressoes(ANTES, ANTES);
  assert.equal(d.iguais.length, 3);
  assert.equal(d.alterados.length + d.novos.length + d.sumidos.length, 0);
  assert.equal(fracaoJaLida(d), 1);
});

test("capítulo NOVO no meio não desloca os outros (o caso do metálico)", () => {
  /*
   * É o caso real: o memorial ganha o volume do metálico entre a arquitetura e
   * as fundações, e TODAS as páginas seguintes andam. Se a identidade do
   * capítulo dependesse de página ou de posição, "3 FUNDACOES" apareceria como
   * removido + novo, e a auditoria incremental releria o documento inteiro.
   */
  const agora = impressaoDosCapitulos([
    cap("1 GENERALIDADES", "O presente memorial descreve a obra.", 1),
    cap("2 ARQUITETURA", "Paredes em alvenaria de blocos ceramicos.", 8),
    cap("3 ESTRUTURA METALICA", "Pilares em perfil laminado W250.", 20),
    cap("4 FUNDACOES", "Estacas escavadas com diametro de 40cm.", 40),
  ]);
  const d = compararImpressoes(ANTES, agora);
  assert.equal(d.iguais.length, 3, "os três de antes seguem iguais");
  assert.equal(d.novos.length, 1);
  assert.equal(d.novos[0].titulo, "3 ESTRUTURA METALICA");
  assert.equal(d.sumidos.length, 0);
  assert.equal(d.alterados.length, 0);
});

test("capítulo reescrito vira ALTERADO, não novo+sumido", () => {
  const agora = impressaoDosCapitulos([
    cap("1 GENERALIDADES", "O presente memorial descreve a obra.", 1),
    cap("2 ARQUITETURA", "Paredes em alvenaria de blocos de concreto.", 8),
    cap("3 FUNDACOES", "Estacas escavadas com diametro de 40cm.", 20),
  ]);
  const d = compararImpressoes(ANTES, agora);
  assert.equal(d.alterados.length, 1);
  assert.equal(d.alterados[0].agora.titulo, "2 ARQUITETURA");
  assert.equal(d.iguais.length, 2);
  assert.equal(d.novos.length, 0);
});

test("título com acento e caixa diferentes ainda é o mesmo capítulo", () => {
  const antes = impressaoDosCapitulos([cap("4 MEMÓRIA DE CÁLCULO", "Texto A", 1)]);
  const agora = impressaoDosCapitulos([cap("4 Memoria de Calculo", "Texto B", 1)]);
  const d = compararImpressoes(antes, agora);
  assert.equal(d.alterados.length, 1);
  assert.equal(d.novos.length, 0);
});

test("só espaço em branco muda: continua igual", () => {
  const antes = impressaoDosCapitulos([cap("1 X", "linha um  linha dois", 1)]);
  const agora = impressaoDosCapitulos([cap("1 X", "linha um\n\n  linha  dois  ", 1)]);
  assert.equal(compararImpressoes(antes, agora).iguais.length, 1);
});

test("capítulo removido aparece como removido", () => {
  const agora = impressaoDosCapitulos([
    cap("1 GENERALIDADES", "O presente memorial descreve a obra.", 1),
    cap("3 FUNDACOES", "Estacas escavadas com diametro de 40cm.", 20),
  ]);
  const d = compararImpressoes(ANTES, agora);
  assert.equal(d.sumidos.length, 1);
  assert.equal(d.sumidos[0].titulo, "2 ARQUITETURA");
});

test("capítulo SEM título só casa por conteúdo (conservador)", () => {
  const antes = impressaoDosCapitulos([cap("", "conteudo antigo", 1)]);
  const agora = impressaoDosCapitulos([cap("", "conteudo novo", 1)]);
  const d = compararImpressoes(antes, agora);
  // Sem título e com texto diferente, não há como afirmar que é o mesmo
  // capítulo: vira novo + sumido, e o pior caso é reenviar ao modelo.
  assert.equal(d.novos.length, 1);
  assert.equal(d.sumidos.length, 1);
  assert.equal(d.alterados.length, 0);
});

test("a fração já lida mede CARACTERES, não capítulos", () => {
  const antes = impressaoDosCapitulos([
    cap("1 X", "a".repeat(9000), 1),
    cap("2 Y", "b".repeat(1000), 5),
  ]);
  const agora = impressaoDosCapitulos([
    cap("1 X", "a".repeat(9000), 1),
    cap("2 Y", "c".repeat(1000), 5),
  ]);
  const d = compararImpressoes(antes, agora);
  // Um capítulo de dois mudou, mas ele é 10% do documento.
  assert.equal(Math.round(fracaoJaLida(d) * 100), 90);
});

test("sem impressão anterior não existe 'nada mudou'", () => {
  const d = compararImpressoes([], ANTES);
  assert.equal(d.iguais.length, 0);
  assert.equal(d.novos.length, 3, "documento inteiro é novo");
  assert.equal(fracaoJaLida(d), 0);
});

test("o resumo diz o que mudou, sem adjetivo", () => {
  const agora = impressaoDosCapitulos([
    cap("1 GENERALIDADES", "O presente memorial descreve a obra.", 1),
    cap("2 ARQUITETURA", "Paredes em alvenaria de blocos ceramicos.", 8),
    cap("3 FUNDACOES", "Estacas escavadas com diametro de 40cm.", 20),
    cap("4 METALICA", "Novo.", 40),
  ]);
  assert.equal(resumoDoDelta(compararImpressoes(ANTES, agora)), "3 igual(is), 1 novo(s)");
});

console.log(`\n${passed} testes ok`);
