/**
 * Teste dos núcleos puros da CONFERÊNCIA DO VOLUME MONTADO.
 *
 *   node scripts/test-nexo-volume-check.ts   (== npm run test:nexo:volume-check)
 */
import assert from "node:assert/strict";

import {
  montarPlanoDePaginas,
  paginasDaParte,
  type BlocoDoPlano,
  type PaginaEsperada,
  type ParteDoPlano,
} from "../server/nexo/volume-plano.ts";

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

// ---------------------------------------------------------------------------
// Task 1 — quantas páginas cada parte contribui
// ---------------------------------------------------------------------------

test("sem faixa, a parte contribui o documento inteiro", () => {
  assert.equal(paginasDaParte(7), 7);
});

test("com faixa, conta só o intervalo (1-based e inclusivo)", () => {
  assert.equal(paginasDaParte(10, 4, 6), 3);
  assert.equal(paginasDaParte(10, 1, 1), 1);
});

test("faixa que estoura o fim do documento para na última página", () => {
  // O selo mentiu a página. `buildRowPdf` copia só o que existe, e a conta
  // aqui tem de bater com o que ele copiou.
  assert.equal(paginasDaParte(10, 4, 99), 7);
});

test("faixa que começa antes da primeira página começa em 1", () => {
  assert.equal(paginasDaParte(10, 0, 3), 3);
  assert.equal(paginasDaParte(10, -5, 2), 2);
});

test("faixa invertida não vira contagem negativa", () => {
  assert.equal(paginasDaParte(10, 8, 3), 0);
});

test("documento vazio ou inválido contribui zero", () => {
  assert.equal(paginasDaParte(0), 0);
  assert.equal(paginasDaParte(Number.NaN), 0);
});

// ---------------------------------------------------------------------------
// Task 2 — a expectativa por página do PDF final
// ---------------------------------------------------------------------------

/** Um volume real de dois blocos: capa + (sep · LD · pranchas) x2. */
const PARTES: ParteDoPlano[] = [
  { papel: "capa", nome: "capa.pdf", paginas: 1 },
  { papel: "separatriz", nome: "sep-est.pdf", paginas: 1, bloco: "est" },
  { papel: "ld", nome: "ld-est.pdf", paginas: 2, bloco: "est" },
  { papel: "prancha", nome: "est.pdf", paginas: 2, bloco: "est" },
  { papel: "separatriz", nome: "sep-arq.pdf", paginas: 1, bloco: "arq" },
  { papel: "ld", nome: "ld-arq.pdf", paginas: 1, bloco: "arq" },
  { papel: "prancha", nome: "arq.pdf", paginas: 3, bloco: "arq" },
];

const BLOCOS: BlocoDoPlano[] = [
  {
    codigo: "est",
    folhas: [
      { folha: 1, total: 2, codigo: "040_26_est_001_a", titulo: "FORMAS PISO" },
      { folha: 2, total: 2, codigo: "040_26_est_002_a", titulo: "FORMAS TOPO" },
    ],
  },
  {
    codigo: "arq",
    folhas: [
      { folha: 1, total: 3, codigo: "040_26_arq_a", titulo: "IMPLANTACAO" },
      { folha: 2, total: 3, codigo: "040_26_arq_a", titulo: "PLANTA TERREO" },
      { folha: 3, total: 3, codigo: "040_26_arq_a", titulo: "CORTES" },
    ],
  },
];

test("cada página do volume ganha a sua expectativa, na ordem", () => {
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  assert.equal(plano.length, 11, "1+1+2+2+1+1+3");
  assert.deepEqual(
    plano.map((p) => p.papel),
    [
      "capa",
      "separatriz", "ld", "ld", "prancha", "prancha",
      "separatriz", "ld", "prancha", "prancha", "prancha",
    ],
  );
  assert.deepEqual(
    plano.map((p) => p.pagina),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
});

test("a página de prancha sabe QUAL folha ela deveria ser", () => {
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  const est = plano.filter((p) => p.papel === "prancha" && p.bloco === "est");
  assert.deepEqual(
    est.map((p) => [p.pagina, p.folha, p.total]),
    [[5, 1, 2], [6, 2, 2]],
  );
  assert.equal(est[0].codigo, "040_26_est_001_a");
  assert.equal(est[1].titulo, "FORMAS TOPO");
});

test("bloco cujo código do ARQUIVO não traz a folha ainda numera certo", () => {
  // A família `arq` imprime "040_26_arq_a" em TODAS as folhas. Quem numera é a
  // ordem dentro do bloco, não o código.
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  const arq = plano.filter((p) => p.papel === "prancha" && p.bloco === "arq");
  assert.deepEqual(arq.map((p) => p.folha), [1, 2, 3]);
  assert.deepEqual(
    arq.map((p) => p.codigo),
    ["040_26_arq_a", "040_26_arq_a", "040_26_arq_a"],
  );
});

test("a capa do volume não pertence a bloco nenhum", () => {
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  assert.equal(plano[0].papel, "capa");
  assert.equal(plano[0].bloco, "");
});

test("mais páginas de prancha do que folhas na LD: o excedente fica sem expectativa", () => {
  // Não é erro DESTE módulo julgar — ele só descreve. Quem acusa é o core.
  const plano = montarPlanoDePaginas(
    [{ papel: "prancha", nome: "x.pdf", paginas: 3, bloco: "est" }],
    [{ codigo: "est", folhas: [{ folha: 1, total: 1, codigo: null, titulo: null }] }],
  );
  assert.equal(plano.length, 3);
  assert.equal(plano[0].folha, 1);
  assert.equal(plano[1].folha, null);
  assert.equal(plano[2].folha, null);
});

test("volume sem capa e sem LD (só pranchas) não quebra", () => {
  const plano = montarPlanoDePaginas(
    [{ papel: "prancha", nome: "x.pdf", paginas: 2, bloco: "" }],
    [],
  );
  assert.deepEqual(plano.map((p) => p.papel), ["prancha", "prancha"]);
  assert.equal(plano[0].folha, null);
});

test("parte de zero páginas não ocupa lugar no volume", () => {
  // Faixa invertida ou PDF vazio: a parte não entrou, e a numeração das
  // seguintes não pode escorregar por causa dela.
  const plano = montarPlanoDePaginas(
    [
      { papel: "separatriz", nome: "sep.pdf", paginas: 0, bloco: "est" },
      { papel: "prancha", nome: "x.pdf", paginas: 2, bloco: "est" },
    ],
    [{ codigo: "est", folhas: [{ folha: 1, total: 2, codigo: null, titulo: null }, { folha: 2, total: 2, codigo: null, titulo: null }] }],
  );
  assert.deepEqual(plano.map((p) => p.pagina), [1, 2]);
  assert.deepEqual(plano.map((p) => p.papel), ["prancha", "prancha"]);
});

console.log(`\n${passed} teste(s) ok`);
