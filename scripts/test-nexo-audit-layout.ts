/**
 * Geometria da auditoria visual: cada página com seus cards logo abaixo, sem um
 * grupo escrever por cima do outro. Puro, node cru.
 *
 *   node scripts/test-nexo-audit-layout.ts   (== npm run test:nexo:audit-layout)
 */
import assert from "node:assert/strict";

import {
  layoutDaAuditoria,
  ALTURA_CARTAO,
  ALTURA_PAGINA,
  FOLGA_CARTAO,
  LARGURA_PAGINA,
  PASSO_CARTAO,
} from "../modules/nexo/lib/layout-auditoria.ts";

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

test("o card fica logo abaixo da sua página, na mesma coluna", () => {
  const l = layoutDaAuditoria({
    paginas: [{ pageNumber: 12, findingIds: ["A", "B"] }],
    semPagina: [],
  });
  const pagina = l.paginas[12];
  assert.deepEqual(pagina, { x: 0, y: 0 });
  assert.equal(l.achados.A.x, pagina.x);
  assert.equal(l.achados.A.y, ALTURA_PAGINA + FOLGA_CARTAO);
  assert.equal(l.achados.B.y, l.achados.A.y + PASSO_CARTAO);
});

test("as páginas ocupam colunas antes de abrir linha nova", () => {
  const paginas = Array.from({ length: 3 }, (_, i) => ({
    pageNumber: i + 1,
    findingIds: [`A${i}`],
  }));
  const l = layoutDaAuditoria({ paginas, semPagina: [] });
  assert.equal(l.paginas[1].y, l.paginas[2].y);
  assert.equal(l.paginas[3].y, l.paginas[1].y);
  assert.ok(l.paginas[2].x > l.paginas[1].x);
});

test("linha nova começa abaixo do grupo mais alto da linha anterior", () => {
  // 7 páginas com 6 colunas: a 7ª cai na segunda linha. A 1ª tem 4 achados.
  const paginas = [
    { pageNumber: 1, findingIds: ["a", "b", "c", "d"] },
    ...Array.from({ length: 6 }, (_, i) => ({
      pageNumber: i + 2,
      findingIds: [`x${i}`],
    })),
  ];
  const l = layoutDaAuditoria({ paginas, semPagina: [] });
  const ultimoCardDaPrimeira = l.achados.d.y + ALTURA_CARTAO;
  assert.ok(
    l.paginas[7].y > ultimoCardDaPrimeira,
    `linha 2 em ${l.paginas[7].y}, cards da linha 1 terminam em ${ultimoCardDaPrimeira}`,
  );
});

test("nenhum grupo se sobrepõe a outro na horizontal", () => {
  const paginas = Array.from({ length: 12 }, (_, i) => ({
    pageNumber: i + 1,
    findingIds: [`A${i}`],
  }));
  const l = layoutDaAuditoria({ paginas, semPagina: [] });
  const naPrimeiraLinha = Object.values(l.paginas)
    .filter((p) => p.y === 0)
    .map((p) => p.x)
    .sort((a, b) => a - b);
  for (let i = 1; i < naPrimeiraLinha.length; i++) {
    assert.ok(
      naPrimeiraLinha[i] - naPrimeiraLinha[i - 1] >= LARGURA_PAGINA,
      "duas páginas na mesma faixa horizontal",
    );
  }
});

test("achado sem página vira bloco abaixo de tudo, e não some", () => {
  const l = layoutDaAuditoria({
    paginas: [{ pageNumber: 3, findingIds: ["A"] }],
    semPagina: ["S1", "S2"],
  });
  assert.ok(l.topoSemPagina);
  assert.ok(l.topoSemPagina!.y > l.achados.A.y);
  assert.equal(l.achados.S1.y, l.topoSemPagina!.y);
  assert.ok(l.achados.S2.x > l.achados.S1.x, "os sem página também usam a grade");
});

test("sem achado sem página, não há bloco", () => {
  const l = layoutDaAuditoria({
    paginas: [{ pageNumber: 3, findingIds: ["A"] }],
    semPagina: [],
  });
  assert.equal(l.topoSemPagina, null);
});

test("auditoria vazia não explode", () => {
  const l = layoutDaAuditoria({ paginas: [], semPagina: [] });
  assert.deepEqual(l.paginas, {});
  assert.deepEqual(l.achados, {});
  assert.equal(l.altura, 0);
});

// A raiz da quantidade é o que impede a torre: 122 páginas em 4 colunas viravam
// 31 linhas que o enquadramento não fechava.
test("muitas páginas ficam quadradas, não em torre", () => {
  const paginas = Array.from({ length: 122 }, (_, i) => ({
    pageNumber: i + 1,
    findingIds: [`A${i}`],
  }));
  const l = layoutDaAuditoria({ paginas, semPagina: [] });
  const linhas = Math.ceil(122 / l.colunas);
  assert.ok(l.colunas >= 11, `colunas=${l.colunas}`);
  assert.ok(linhas <= l.colunas + 1, `${linhas} linhas para ${l.colunas} colunas`);
});

console.log(`\n${passed} testes ok`);
