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
import { promptDaLeituraGlobal } from "../lib/prompts-da-leitura.ts";

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

test("o prompt da leitura global usa a definição única", () => {
  /*
   * Lia o FONTE de route.ts procurando a interpolação. Desde 26/09/2026 o
   * prompt mora em lib/prompts-da-leitura.ts, e dá para conferir o texto que de
   * fato vai ao modelo — que é o que importa.
   */
  const global = promptDaLeituraGlobal({
    auditMode: "memorial",
    userMessage: "",
    projectName: "",
    learningContext: "",
    fileName: "a.pdf",
    fileType: "memorial",
    paginas: 1,
    gabarito: "",
    textoDoDocumento: "",
  });
  assert.ok(global.includes(CRITERIO_DAS_FAIXAS), "a leitura global não interpola CRITERIO_DAS_FAIXAS");

  for (const arquivo of ["app/api/audit/route.ts", "lib/prompts-da-leitura.ts"]) {
    assert.ok(
      !readFileSync(arquivo, "utf8").includes(
        '"critico_documental" (impede emitir), "tecnico_contratual" (exige decisão',
      ),
      `a definição abreviada ainda está em ${arquivo}`,
    );
  }
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

test("risco na execução é faixa própria, entre o crítico e o técnico (16/10)", () => {
  /*
   * Parecer do 027-24 de 24/09: aterramento de 25 Ω × 10 Ω saía técnico Media,
   * abaixo de "títulos iguais em itens distintos". O exemplo fica escrito na
   * régua para o modelo não tratar valor incompatível como premissa a demonstrar.
   */
  const linhas = CRITERIO_DAS_FAIXAS.split("\n");
  const ordem = ["critico_documental", "risco_de_execucao", "tecnico_contratual", "revisao_editorial"].map(
    (f) => linhas.findIndex((l) => l.includes(`"${f}"`)),
  );
  assert.ok(ordem.every((i) => i >= 0), "falta faixa na régua");
  assert.deepEqual([...ordem].sort((x, y) => x - y), ordem, "a régua tem de vir na ordem da gravidade");
  assert.match(linhas[ordem[1]], /aterramento/i);
});

test("unidade com valor pretendido óbvio é técnica; a ambígua continua crítica", () => {
  const linhas = CRITERIO_DAS_FAIXAS.split("\n");
  const critico = linhas.find((l) => l.includes('"critico_documental"')) ?? "";
  const tecnico = linhas.find((l) => l.includes('"tecnico_contratual"')) ?? "";
  assert.match(critico, /NÃO permite deduzir/);
  assert.match(tecnico, /0,88 cm/);
});

console.log(`\n${passed} teste(s) de faixas de impacto OK`);
