/**
 * Teste da LIMPEZA da descrição do carimbo — `cleanStampDescription`.
 *
 *   node scripts/test-ld-descricao-do-selo.ts
 * (também exposto como `npm run test:ld:descricao`)
 *
 * ## Por que este arquivo existe
 *
 * A limpeza corta a descrição no primeiro RÓTULO VIZINHO do carimbo (IMP, DATA,
 * ESCALA, REV…), porque num carimbo linearizado o valor do CONTEÚDO vinha com o
 * rótulo do lado grudado atrás — "PLANTA BAIXA IMP 001" na coluna DESCRIÇÃO da
 * LD entregue.
 *
 * O corte não tinha BORDA À DIREITA: o padrão `IMP` casava dentro de
 * "IMPLANTAÇÃO", `REV` dentro de "REVESTIMENTOS", `VISTO` dentro de "VISTORIA".
 * "PLANTA DE IMPLANTAÇÃO" — a descrição mais comum que existe numa prancha
 * brasileira — chegava à LD como "PLANTA DE". Dez de quinze descrições reais
 * saíam pela metade, e ninguém via, porque o que sobra ainda parece um título.
 *
 * Estes casos travam as duas metades da regra: o rótulo vizinho continua sendo
 * cortado, e a PALAVRA que apenas começa igual a um rótulo continua inteira.
 */
import assert from "node:assert/strict";

import { cleanStampDescription } from "../lib/ld/stamp-parsing.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("descrição do carimbo\n");

// --- 1. O que a limpeza existe para cortar -----------------------------------

check("corta o rótulo vizinho com dois-pontos", () => {
  assert.equal(cleanStampDescription("PLANTA BAIXA IMP: 001"), "PLANTA BAIXA");
  assert.equal(cleanStampDescription("PLANTA BAIXA DATA: JUNHO/2026"), "PLANTA BAIXA");
  assert.equal(cleanStampDescription("PLANTA BAIXA ESCALA: 1:50"), "PLANTA BAIXA");
});

check("corta o rótulo vizinho sem dois-pontos (carimbo em grade)", () => {
  assert.equal(cleanStampDescription("PLANTA BAIXA ESCALA INDICADA"), "PLANTA BAIXA");
  assert.equal(cleanStampDescription("PLANTA BAIXA REV A"), "PLANTA BAIXA");
});

check("descarta a linha que É o rótulo", () => {
  assert.equal(cleanStampDescription("PRANCHA 01/15"), "");
  assert.equal(cleanStampDescription("ARQUIVO 040_26_est_imp_001_a"), "");
});

check("tira o rótulo do próprio campo", () => {
  assert.equal(cleanStampDescription("CONTEÚDO: PLANTA BAIXA"), "PLANTA BAIXA");
  assert.equal(cleanStampDescription("DESCRIÇÃO - CORTES E ELEVAÇÕES"), "CORTES E ELEVAÇÕES");
});

// --- 2. O que ela NÃO pode cortar --------------------------------------------
//
// Cada linha abaixo é uma descrição que sai pela metade quando o corte não tem
// borda à direita. A palavra que sobra ainda parece um título — e é por isso
// que o defeito atravessou o produto inteiro sem ser visto.

check("IMP não corta IMPLANTAÇÃO nem IMPERMEABILIZAÇÃO", () => {
  assert.equal(cleanStampDescription("PLANTA DE IMPLANTAÇÃO"), "PLANTA DE IMPLANTAÇÃO");
  assert.equal(
    cleanStampDescription("DETALHES DE IMPERMEABILIZAÇÃO"),
    "DETALHES DE IMPERMEABILIZAÇÃO",
  );
});

check("REV não corta REVESTIMENTOS nem REVITALIZAÇÃO", () => {
  assert.equal(
    cleanStampDescription("PLANTA DE COBERTURA E REVESTIMENTOS"),
    "PLANTA DE COBERTURA E REVESTIMENTOS",
  );
  assert.equal(
    cleanStampDescription("PROJETO DE REVITALIZAÇÃO DA PRAÇA CENTRAL"),
    "PROJETO DE REVITALIZAÇÃO DA PRAÇA CENTRAL",
  );
});

check("VISTO não corta VISTORIA, DESENHO não corta DESENHOS", () => {
  assert.equal(cleanStampDescription("RELATÓRIO DE VISTORIA TÉCNICA"), "RELATÓRIO DE VISTORIA TÉCNICA");
  assert.equal(
    cleanStampDescription("QUADRO DE DESENHOS COMPLEMENTARES"),
    "QUADRO DE DESENHOS COMPLEMENTARES",
  );
});

check("OBRA não corta OBRAS, FASE não corta FASEAMENTO", () => {
  assert.equal(cleanStampDescription("CANTEIRO DE OBRAS"), "CANTEIRO DE OBRAS");
  assert.equal(cleanStampDescription("FASEAMENTO EXECUTIVO"), "FASEAMENTO EXECUTIVO");
});

// --- 3. A palavra INTEIRA no meio da descrição --------------------------------
//
// Aqui o rótulo aparece como palavra inteira, mas é PARTE do título: "DA OBRA"
// e "FOLHA 02" são texto do projetista, não campo vizinho do carimbo. O sinal
// que separa os dois é o dois-pontos — sem ele, uma palavra no meio de uma frase
// (precedida de preposição, ou seguida de mais texto) é título.

check("palavra do título não é rótulo: DA OBRA, FOLHA 02", () => {
  assert.equal(
    cleanStampDescription("PLANTA DE SITUAÇÃO E LOCAÇÃO DA OBRA"),
    "PLANTA DE SITUAÇÃO E LOCAÇÃO DA OBRA",
  );
  assert.equal(cleanStampDescription("PLANTA BAIXA - FOLHA 02"), "PLANTA BAIXA - FOLHA 02");
});

// --- 4. Controles: o que sempre passou inteiro precisa continuar passando ------

check("descrições sem rótulo nenhum passam intactas", () => {
  for (const d of [
    "CORTES E ELEVAÇÕES",
    "PLANTA BAIXA GERAL",
    "DETALHAMENTO DE ESQUADRIAS",
    "ESCADA 01: DETALHAMENTO GERAL",
    "ARMAÇÃO POSITIVA - LAJE TIPO",
  ]) {
    assert.equal(cleanStampDescription(d), d);
  }
});

check("espaços colapsam e pontuação solta no fim sai", () => {
  assert.equal(cleanStampDescription("  PLANTA   BAIXA  "), "PLANTA BAIXA");
  assert.equal(cleanStampDescription("PLANTA BAIXA -"), "PLANTA BAIXA");
});

console.log(`\n${passed} teste(s) passaram.`);
