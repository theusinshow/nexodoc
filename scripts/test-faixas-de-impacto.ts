/**
 * UMA DEFINIÇÃO DE FAIXA SÓ.
 *
 * 17/09/2026, benchmark do 027-24: a validação mandava como `instructions` o prompt
 * do auditor ("duas ordens opostas de prevalência" = crítico) e como `input` um
 * prompt que dizia "crítico = somente troca real de obra; hierarquia = técnico".
 * A hierarquia contraditória saiu técnica e um arredondamento saiu crítico. Este
 * teste impede que as três cópias voltem a divergir.
 *
 *   node scripts/test-faixas-de-impacto.ts   (== npm run test:faixas-de-impacto)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CRITERIO_DAS_FAIXAS } from "../lib/faixas-de-impacto.ts";
import { getAuditorPrompt } from "../lib/auditor-prompt.ts";
import { getFindingValidationPrompt } from "../lib/audit-validation-prompt.ts";

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

const promptDaValidacao = getFindingValidationPrompt({
  auditMode: "memorial",
  userMessage: "audita",
  projectName: "027-24",
  learningContext: "",
  files: [],
  findings: [],
});

test("o prompt do auditor usa a definição única", () => {
  assert.ok(getAuditorPrompt("memorial").includes(CRITERIO_DAS_FAIXAS));
});

test("o prompt da validação usa a MESMA definição", () => {
  assert.ok(promptDaValidacao.includes(CRITERIO_DAS_FAIXAS));
});

test("a definição antiga e contraditória da validação saiu", () => {
  assert.ok(!/somente quando houver troca real de obra/i.test(promptDaValidacao));
  assert.ok(!/norma\/cálculo\/hierarquia que exige conferência/i.test(promptDaValidacao));
});

test("o prompt dos blocos do Profundo (route.ts) usa a definição única", () => {
  const rota = readFileSync("app/api/audit/route.ts", "utf8");
  assert.ok(rota.includes("${CRITERIO_DAS_FAIXAS}"), "route.ts não interpola CRITERIO_DAS_FAIXAS");
  assert.ok(
    !rota.includes('"critico_documental" (impede emitir), "tecnico_contratual" (exige decisão'),
    "a definição abreviada ainda está em route.ts",
  );
});

test("conta errada tem nome: adotado ≠ usado na própria fórmula é aritmético e crítico", () => {
  const critico = CRITERIO_DAS_FAIXAS.split("\n").find((l) => l.includes('"critico_documental"')) ?? "";
  assert.match(critico, /adotado/i);
  assert.match(critico, /própria fórmula/i);
});

test("resíduo genérico de modelo é técnico, não crítico (decisão de 17/09)", () => {
  const tecnico = CRITERIO_DAS_FAIXAS.split("\n").find((l) => l.includes('"tecnico_contratual"')) ?? "";
  assert.match(tecnico, /apartamento/i);
});

test("arredondamento é editorial", () => {
  const editorial = CRITERIO_DAS_FAIXAS.split("\n").find((l) => l.includes('"revisao_editorial"')) ?? "";
  assert.match(editorial, /arredondamento/i);
});

console.log(`\n${passed} teste(s) de faixas de impacto OK`);
