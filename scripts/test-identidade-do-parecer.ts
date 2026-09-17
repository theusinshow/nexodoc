/**
 * O CABEÇALHO DO PARECER (obra, órgão, município, código).
 *
 * 17/09/2026, auditoria 5cb5b3b2 do 027-24: o cartão mandou a obra da capa como
 * gabarito, e o parecer saiu com obra "Projeto de Urbanização da Orla … (027-24)
 * Tempo de concentração (min): 6 TR (anos): 10 …" (linha "OBRA :" de uma tabela
 * de drenagem), órgão com a secretaria e a obra colados, e município "Antônio
 * Carlos" (a jazida de empréstimo). Era a terceira leitura de identidade do
 * sistema, e a única que não lia a capa nem o que foi declarado.
 *
 *   node scripts/test-identidade-do-parecer.ts   (== npm run test:identidade-do-parecer)
 */
import assert from "node:assert/strict";

import { identidadeDoParecer } from "../lib/identidade-do-parecer.ts";

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

const CAPA =
  "--- PAGINA 1 ---\nPREFEITURA MUNICIPAL DE SÃO JOSÉ\nSECRETARIA MUNICIPAL DE INFRAESTRUTURA\n" +
  "BEIRA MAR DE SÃO JOSÉ - BARREIROS\nURBANIZAÇÃO DA ORLA - PARQUE,\nRESTAURANTE E LANCHONETE\n" +
  "PROJETO EXECUTIVO\nMEMORIAL DESCRITIVO\nVol. I\nOUTUBRO 2025\n027-24\n\n--- PAGINA 2 ---\nSumário\n";

/** O que `inferProjectFields` devolveu na auditoria 5cb5b3b2. */
const INFERIDO = {
  obra: "Projeto de Urbanização da Orla da Beira Mar Continental de São José (027-24) Tempo de concentração (min): 6 TR (anos): 10 Intensidade de precipitação (cm/h): 20",
  orgao: "PREFEITURA MUNICIPAL DE SÃO JOSÉ SECRETARIA MUNICIPAL DE INFRAESTRUTURA BEIRA MAR DE SÃO JOSÉ",
  municipio: "município de Antônio Carlos",
  codigo: "027-24",
};

const OBRA_DA_CAPA =
  "BEIRA MAR DE SÃO JOSÉ - BARREIROS URBANIZAÇÃO DA ORLA - PARQUE, RESTAURANTE E LANCHONETE";

test("REGRESSÃO 5cb5b3b2: com gabarito declarado, o cabeçalho é o gabarito", () => {
  const id = identidadeDoParecer({
    gabarito: {
      obra: OBRA_DA_CAPA,
      prefeitura: "PREFEITURA MUNICIPAL DE SÃO JOSÉ",
      municipio: "São José",
      centroCusto: "027-24",
    },
    texto: CAPA,
    inferido: INFERIDO,
  });
  assert.deepEqual(id, {
    obra: OBRA_DA_CAPA,
    orgao: "PREFEITURA MUNICIPAL DE SÃO JOSÉ",
    municipio: "São José",
    codigo: "027-24",
  });
});

test("sem gabarito, a capa vence a leitura solta do texto", () => {
  const id = identidadeDoParecer({ texto: CAPA, inferido: INFERIDO });
  assert.equal(id.obra, OBRA_DA_CAPA);
  assert.equal(id.orgao, "PREFEITURA MUNICIPAL DE SÃO JOSÉ");
  assert.equal(id.municipio, "São José");
  assert.equal(id.codigo, "027-24");
});

test("gabarito parcial: o que não foi declarado vem da capa", () => {
  const id = identidadeDoParecer({ gabarito: { obra: "OBRA DECLARADA" }, texto: CAPA, inferido: INFERIDO });
  assert.equal(id.obra, "OBRA DECLARADA");
  assert.equal(id.orgao, "PREFEITURA MUNICIPAL DE SÃO JOSÉ");
});

test("sem gabarito e sem capa, vale o inferido como antes", () => {
  const id = identidadeDoParecer({ texto: "--- PAGINA 1 ---\nSumário\n", inferido: INFERIDO });
  assert.deepEqual(id, INFERIDO);
});

console.log(`\n${passed} teste(s) de identidade do parecer OK`);
