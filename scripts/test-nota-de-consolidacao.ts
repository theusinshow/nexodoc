/**
 * O ACHADO QUE FALA DE OUTRO ACHADO NÃO É UM ACHADO.
 *
 * Caso real: INC-052 do parecer do 117_25 em 18/08/2026.
 *
 *   node scripts/test-nota-de-consolidacao.ts  (== npm run test:nota-consolidacao)
 */
import assert from "node:assert/strict";

import {
  ehNotaDeConsolidacao,
  semNotasDeConsolidacao,
} from "../lib/nota-de-consolidacao.ts";

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

/** O INC-052 como saiu do modelo, campo por campo. */
const INC_052 = {
  id: "INC-052",
  tipo: "Achado duplicado",
  descricao: "A ocorrência foi consolidada no INC-019.",
  conflito: "O mesmo erro de sigla aparece nas páginas 29 e 31 e deve formar um único achado.",
  sugestao_correcao: "Tratar ambas as ocorrências pelo INC-019.",
  evidencia: "“a 6,1 km da USB Vila Manaus.”",
  pagina: "31",
} as never;

/** O INC-050, que é achado de verdade: o sujeito dele é o MEMORIAL. */
const INC_050 = {
  id: "INC-050",
  tipo: "Parágrafo duplicado no mesmo documento",
  descricao: "1 parágrafo(s) longo(s) aparecem mais de uma vez no documento.",
  conflito: "O mesmo texto aparece repetido; se as duas ocorrências forem intencionais, uma delas deve ser remissão à outra.",
  sugestao_correcao: "Manter uma ocorrência e transformar a outra em remissão.",
  pagina: "74",
} as never;

test("o caso real: INC-052 é nota de consolidação", () => {
  assert.equal(ehNotaDeConsolidacao(INC_052), true);
});

test("INC-050 NÃO é: ele fala do documento, não do parecer", () => {
  /*
   * É o teste que impede o conserto de virar o próximo esconde-achado. As duas
   * linhas contêm a palavra "duplicado"; o que as separa é o SUJEITO.
   */
  assert.equal(ehNotaDeConsolidacao(INC_050), false);
});

test("sem referência interna, nada é removido", () => {
  const legitimo = {
    tipo: "Achado duplicado",
    descricao: "O mesmo defeito aparece duas vezes no memorial.",
  } as never;
  assert.equal(
    ehNotaDeConsolidacao(legitimo),
    false,
    "sem citar INC-xxx não há como saber que fala do parecer",
  );
});

test("frase de consolidação com referência também sai", () => {
  const f = {
    tipo: "Ortografia",
    descricao: "Ocorrência tratada no INC-007.",
  } as never;
  assert.equal(ehNotaDeConsolidacao(f), true);
});

test("palavra 'consolidado' sobre o documento não basta", () => {
  // "orçamento consolidado" é afirmação sobre a obra, não sobre o parecer.
  const f = {
    tipo: "Escopo",
    descricao: "O orçamento consolidado não bate com o quadro de áreas.",
  } as never;
  assert.equal(ehNotaDeConsolidacao(f), false);
});

test("a lista devolve o que ficou E o que saiu", () => {
  /*
   * Filtro que descarta em silêncio é a próxima coisa a esconder achado — este
   * produto já pagou por isso (as 4 regras que escondiam achado, 12/08).
   */
  const { mantidos, removidos } = semNotasDeConsolidacao([INC_050, INC_052] as never);
  assert.equal(mantidos.length, 1);
  assert.equal(removidos.length, 1);
  assert.equal(removidos[0].id, "INC-052");
});

test("lista sem notas passa inteira", () => {
  const { mantidos, removidos } = semNotasDeConsolidacao([INC_050] as never);
  assert.equal(mantidos.length, 1);
  assert.equal(removidos.length, 0);
});

console.log(`\n${passed} teste(s) de nota de consolidação OK`);
