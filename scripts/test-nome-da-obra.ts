/**
 * O NOME DA OBRA — o gabarito de que toda a auditoria depende.
 *
 * No memorial 084_25 (17/08/2026) ele saiu truncado no fecha-parêntese, e a
 * regra de identidade passou a acusar de "obra divergente" as páginas que
 * citavam a obra pelo nome próprio — que é o certo.
 *
 *   node scripts/test-nome-da-obra.ts   (== npm run test:nome-da-obra)
 */
import assert from "node:assert/strict";

import { nomeDaObra } from "../lib/nome-da-obra.ts";

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

const OBRA = "Reforma e Adequação da EMEB (Escola Municipal de Ensino Básico) Rubens de Arruda Ramos";

test("REGRESSÃO 084_25: o campo quebrando linha no parêntese não trunca", () => {
  /*
   * Este é o caso real. A captura era `[^,.;\n]` e o `\n` só passou a existir
   * dentro de uma página quando a extração parou de achatar tudo, no mesmo dia.
   */
  const texto =
    "Obra: Reforma e Adequação da EMEB (Escola Municipal de Ensino Básico)\n" +
    "Rubens de Arruda Ramos\n" +
    "Município: Criciúma";
  assert.equal(nomeDaObra(texto), OBRA);
});

test("REGRESSÃO 084_25: o rodapé com parêntese casa", () => {
  const texto = `084_25 – ${OBRA.toUpperCase()} – PROJETO EXECUTIVO`;
  assert.match(nomeDaObra(texto), /RUBENS DE ARRUDA RAMOS/i);
});

test("a continuação PARA no próximo campo, não o engole", () => {
  /*
   * Juntar linhas sem guarda devolveria "...Ramos Município: Criciúma" — pior
   * que truncar, porque gabarito errado é aceito em silêncio.
   */
  const texto = "Obra: Centro Comunitário Primeira Linha\nMunicípio: Criciúma\nÓrgão: PMC";
  assert.equal(nomeDaObra(texto), "Centro Comunitário Primeira Linha");
});

test("pontuação fecha o nome", () => {
  assert.equal(
    nomeDaObra("Obra: Centro Comunitário Primeira Linha, em Criciúma/SC."),
    "Centro Comunitário Primeira Linha",
  );
});

test("o rodapé vence o campo quando os dois existem", () => {
  // O rodapé se repete em todas as páginas e costuma vir mais limpo.
  const texto = "Obra: nome da capa\n017_26 – CENTRO COMUNITARIO PRIMEIRA LINHA – PROJETO EXECUTIVO";
  assert.equal(nomeDaObra(texto), "CENTRO COMUNITARIO PRIMEIRA LINHA");
});

test("nome sem parêntese continua funcionando (017_26)", () => {
  assert.equal(
    nomeDaObra("017_26 – CENTRO COMUNITARIO PRIMEIRA LINHA – PROJETO EXECUTIVO"),
    "CENTRO COMUNITARIO PRIMEIRA LINHA",
  );
});

test("nome com número e ponto (UBS Porte 2)", () => {
  assert.equal(
    nomeDaObra("040_26 – UBS SANTO ANTONIO PORTE 2 – PROJETO EXECUTIVO"),
    "UBS SANTO ANTONIO PORTE 2",
  );
});

test("sem obra, devolve vazio — nunca chuta", () => {
  // Gabarito inventado é pior que ausente: ele reprova a obra certa.
  assert.equal(nomeDaObra("Memorial descritivo de alguma coisa qualquer."), "");
  assert.equal(nomeDaObra(""), "");
});

test("nome absurdamente longo é cortado, não devolvido inteiro", () => {
  const t = nomeDaObra(`Obra: ${"A".repeat(400)}`);
  assert.ok(t.length <= 160, `devolveu ${t.length} chars`);
});

test("linha em branco depois do nome encerra", () => {
  assert.equal(
    nomeDaObra("Obra: Centro Comunitário Primeira Linha\n\nOutro parágrafo qualquer"),
    "Centro Comunitário Primeira Linha",
  );
});

console.log(`\n${passed} teste(s) de nome da obra OK`);
