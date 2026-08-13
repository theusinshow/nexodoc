/**
 * O MAPA COMPRIMIDO dos capítulos que não mudaram.
 *
 * É o que impede a reauditoria barata de ficar cega para contradição entre o
 * capítulo novo e um que ficou parado — o volume do metálico que entrou contra
 * a fundação do capítulo 3, que ninguém tocou.
 *
 * A passada de validação NÃO cobre isso: o prompt dela diz, literalmente, que a
 * tarefa não é procurar erros novos. Se a leitura não vir os dois lados,
 * ninguém vê.
 *
 *   node scripts/test-audit-mapa.ts   (== npm run test:audit:mapa)
 */
import assert from "node:assert/strict";

import { buildMapaDosIguais } from "../lib/audit-validation-prompt.ts";
import type { CapituloImpresso } from "../lib/audit-report.ts";

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

const cap = (
  titulo: string,
  startPage: number,
  endPage: number,
  hash: string,
): CapituloImpresso => ({ titulo, startPage, endPage, chars: 100, hash });

test("cada capítulo vira uma linha com título, páginas e resumo", () => {
  const mapa = buildMapaDosIguais(
    [cap("3 - FUNDACOES", 20, 24, "hf")],
    [{ hash: "hf", resumo: "Sapata isolada, fck 25 MPa, executada pela contratada." }],
  );
  assert.match(mapa, /3 - FUNDACOES/);
  assert.match(mapa, /20-24/);
  assert.match(mapa, /Sapata isolada, fck 25 MPa/);
});

test("capítulo sem síntese aparece mesmo assim — a forma do documento importa", () => {
  // Parecer anterior pode ter impressão sem síntese (auditoria de antes desta
  // etapa). Omitir o capítulo faria o modelo achar que o documento é menor do
  // que é, e um capítulo invisível não pode ser contradito.
  const mapa = buildMapaDosIguais([cap("4 - HIDRAULICA", 25, 30, "hh")], []);
  assert.match(mapa, /4 - HIDRAULICA/);
  assert.match(mapa, /25-30/);
});

test("capítulo sem título não vira linha anônima", () => {
  const mapa = buildMapaDosIguais([cap("", 31, 33, "hx")], []);
  assert.match(mapa, /\(sem título\)/);
  assert.match(mapa, /31-33/);
});

test("sem capítulo nenhum, o mapa é vazio e não vira texto solto no prompt", () => {
  assert.equal(buildMapaDosIguais([], []), "");
  assert.equal(buildMapaDosIguais([], [{ hash: "hf", resumo: "orfa" }]), "");
});

test("síntese de capítulo que não está na lista é ignorada", () => {
  // Só entram os capítulos que o plano de reuso manteve como iguais; síntese de
  // capítulo alterado não pode vazar para o mapa, senão o modelo leria duas
  // versões do mesmo trecho — a do texto integral e a do resumo velho.
  const mapa = buildMapaDosIguais(
    [cap("3 - FUNDACOES", 20, 24, "hf")],
    [
      { hash: "hf", resumo: "resumo certo" },
      { hash: "houtro", resumo: "resumo de capitulo alterado" },
    ],
  );
  assert.match(mapa, /resumo certo/);
  assert.doesNotMatch(mapa, /capitulo alterado/);
});

console.log(`\n${passed} verificações do mapa passaram.`);
