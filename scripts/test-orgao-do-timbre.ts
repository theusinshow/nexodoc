/**
 * O ÓRGÃO lido do timbre do memorial — "PREFEITURA MUNICIPAL DE <cidade>".
 *
 * No 027_24 (São José, 17/09/2026) o chat anunciou "PREFEITURA MUNICIPAL DE SÃO
 * JOSÉ SECRETARIA MUNICIPAL DE INFRAEST": a captura aceitava quebra de linha,
 * engolia a linha da secretaria e parava no teto de 40 caracteres. Chapecó e
 * Navegantes saíam do mesmo jeito.
 *
 *   node scripts/test-orgao-do-timbre.ts   (== npm run test:orgao-do-timbre)
 */
import assert from "node:assert/strict";

import { orgaoDoTimbre } from "../lib/orgao-do-timbre.ts";

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

test("REGRESSÃO 027_24: a linha da secretaria não é engolida", () => {
  assert.equal(
    orgaoDoTimbre("PREFEITURA MUNICIPAL DE SÃO JOSÉ\nSECRETARIA MUNICIPAL DE INFRAESTRUTURA\nBEIRA MAR"),
    "PREFEITURA MUNICIPAL DE SÃO JOSÉ",
  );
});

test("Chapecó e Navegantes, mesmo modelo de capa", () => {
  assert.equal(
    orgaoDoTimbre("PREFEITURA MUNICIPAL DE CHAPECÓ\nSECRETARIA DE PLANEJAMENTO E DESENVOLVIMENTO"),
    "PREFEITURA MUNICIPAL DE CHAPECÓ",
  );
  assert.equal(
    orgaoDoTimbre("PREFEITURA MUNICIPAL DE NAVEGANTES\nSECRETARIA MUNICIPAL DE PLANEJAMENTO URBANO"),
    "PREFEITURA MUNICIPAL DE NAVEGANTES",
  );
});

test("rodapé de Criciúma continua parando no travessão", () => {
  assert.equal(
    orgaoDoTimbre("PREFEITURA MUNICIPAL DE CRICIÚMA – 116-25 – UBS RENASCER - PORTE 2 – PROJETO"),
    "PREFEITURA MUNICIPAL DE CRICIÚMA",
  );
});

test("pontuação fecha o nome (kit: 'Prefeitura Municipal de Icara.')", () => {
  assert.equal(
    orgaoDoTimbre("Proprietario: Prefeitura Municipal de Icara. Municipio: Icara;"),
    "Prefeitura Municipal de Icara",
  );
});

test("sem timbre, vazio", () => {
  assert.equal(orgaoDoTimbre("Memorial descritivo qualquer"), "");
});

console.log(`\n${passed} teste(s) de órgão do timbre OK`);
