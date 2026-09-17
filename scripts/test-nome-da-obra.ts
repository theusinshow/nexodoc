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

/*
 * 027_24 (São José, 17/09/2026). O chat anunciou a obra como "• Diário de Obra
 * Em Dia": o rodapé não casou e o campo pegou a PROSA "canteiro de obra:" da
 * página 40, porque a busca do rótulo ignorava a caixa. Texto abaixo é o da
 * extração real.
 */
const CAPA_SAO_JOSE =
  "--- PAGINA 1 ---\n" +
  "PREFEITURA MUNICIPAL DE SÃO JOSÉ\n" +
  "SECRETARIA MUNICIPAL DE INFRAESTRUTURA\n" +
  "BEIRA MAR DE SÃO JOSÉ - BARREIROS\n" +
  "URBANIZAÇÃO DA ORLA - PARQUE,\n" +
  "RESTAURANTE E LANCHONETE\n" +
  "PROJETO EXECUTIVO\n" +
  "MEMORIAL DESCRITIVO\n" +
  "Vol. I\n" +
  "OUTUBRO 2025\n" +
  "027-24\n\n" +
  "--- PAGINA 2 ---\n" +
  "Sumário\n";

const PROSA_CANTEIRO =
  "A Construtora manterá no canteiro de obra:\n" +
  "• Diário de Obra em dia, com os registros das alterações autorizadas e demais situações\n";

test("REGRESSÃO 027_24: a prosa 'canteiro de obra:' não vira nome da obra", () => {
  assert.equal(nomeDaObra(PROSA_CANTEIRO), "");
});

test("REGRESSÃO 027_24: o nome sai da capa PREFEITURA / SECRETARIA / nome / PROJETO", () => {
  assert.equal(
    nomeDaObra(`${CAPA_SAO_JOSE}\n--- PAGINA 40 ---\n${PROSA_CANTEIRO}`),
    "BEIRA MAR DE SÃO JOSÉ - BARREIROS URBANIZAÇÃO DA ORLA - PARQUE, RESTAURANTE E LANCHONETE",
  );
});

test("a capa vence um campo 'OBRA :' de tabela no miolo", () => {
  // O 027_24 tem, numa tabela de drenagem, "OBRA : Projeto de Urbanização ...
  // Tempo de concentração (min): 6" — rótulo de verdade, mas de tabela.
  const miolo =
    "--- PAGINA 60 ---\nOBRA : Projeto de Urbanização da Orla (027-24) Tempo de concentração (min): 6\n";
  assert.match(nomeDaObra(`${CAPA_SAO_JOSE}\n${miolo}`), /^BEIRA MAR DE SÃO JOSÉ/);
});

test("o rodapé continua vencendo a capa (040_26, Chapecó)", () => {
  const texto =
    "--- PAGINA 1 ---\nPREFEITURA MUNICIPAL DE CHAPECÓ\nSECRETARIA DE PLANEJAMENTO E DESENVOLVIMENTO\n" +
    "REVITALIZAÇÃO DA FEIRA MUNICIPAL\nDE CHAPECÓ\nPROJETO EXECUTIVO\nMEMORIAL DESCRITIVO\n\n" +
    "--- PAGINA 5 ---\n040_26 – REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ – PROJETO EXECUTIVO";
  assert.equal(nomeDaObra(texto), "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ");
});

test("capa sem o timbre de prefeitura não é lida — o campo segue valendo (116_25)", () => {
  // A capa de Criciúma é outro modelo ("G O V E R N O  D O  M U N I C Í P I O");
  // o gabarito dela vem do campo "Obra:" e não pode mudar com este conserto.
  const texto =
    "--- PAGINA 1 ---\nE S T A D O D E S A N T A C A T A R I N A\n" +
    "G O V E R N O D O M U N I C Í P I O D E C R I C I Ú M A\nUBS RENASCER - PORTE 2\n" +
    "BAIRRO SÃO JOÃO\nVOLUME 1 – MEMORIAL DESCRITIVO\n116-25\n\n" +
    "--- PAGINA 3 ---\n1 Caracterização da obra\nObra: Unidade Básica de Saúde localizada na Rua Pedro Antônio, S/N";
  assert.equal(nomeDaObra(texto), "Unidade Básica de Saúde localizada na Rua Pedro Antônio");
});

test("capa sem linha de encerramento (PROJETO/MEMORIAL) não chuta", () => {
  const texto = "--- PAGINA 1 ---\nPREFEITURA MUNICIPAL DE SÃO JOSÉ\nALGUMA COISA\nOUTRA COISA\n";
  assert.equal(nomeDaObra(texto), "");
});

console.log(`\n${passed} teste(s) de nome da obra OK`);
