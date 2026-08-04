/**
 * Smoke-test do locateTermOnPage — acha a posição aproximada de um trecho na
 * camada de texto do pdf.js pra ancorar o pin do erro. Puro, node cru.
 *
 *   node scripts/test-nexo-locate-term.ts   (== npm run test:nexo:locate-term)
 */
import assert from "node:assert/strict";

import { locateTermOnPage } from "../server/nexo/audit/locate-term.ts";
import type { TextItem } from "../server/nexo/audit/locate-term.ts";

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

// transform = [a, b, c, d, e, f]; e = x, f = y (origem inferior-esquerda do PDF)
function item(str: string, x: number, y: number): TextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width: str.length * 5, height: 10 };
}

const PAGE = { pageWidth: 600, pageHeight: 800 };

test("acha o item e devolve percentual (y invertido)", () => {
  const items: TextItem[] = [
    item("Cabeçalho do documento", 60, 760),
    item("UBS Central de Chapecó", 120, 400),
  ];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "UBS Central de Chapecó" });
  assert.ok(pos);
  assert.ok(Math.abs(pos!.xPct - 120 / 600) < 0.01);
  // y do PDF é de baixo pra cima; no DOM é de cima pra baixo -> 1 - f/altura
  assert.ok(Math.abs(pos!.yPct - (1 - 400 / 800)) < 0.01);
});

test("busca tolerante a acento/caixa", () => {
  const items = [item("ubs central de chapeco", 100, 200)];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "UBS Central de Chapecó" });
  assert.ok(pos);
});

test("casa por prefixo quando o termo é longo", () => {
  const items = [item("Rua das Flores, 123 - Centro, Xanxerê", 90, 300)];
  const pos = locateTermOnPage({
    items,
    ...PAGE,
    termo: "Rua das Flores, 123 - Centro, Xanxerê - SC, CEP 89820-000",
  });
  assert.ok(pos);
});

test("termo não encontrado -> null", () => {
  const items = [item("outro conteúdo qualquer", 10, 10)];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "UBS Central de Chapecó" });
  assert.equal(pos, null);
});

test("termo vazio -> null", () => {
  const items = [item("qualquer", 10, 10)];
  assert.equal(locateTermOnPage({ items, ...PAGE, termo: "" }), null);
});

// A camada de texto do pdf.js quebra a linha em vários itens curtos ("de", "da",
// "e"). Casar item-dentro-do-termo com um item de 2 letras poria o pin em
// qualquer lugar da página — o pin errado é pior que nenhum pin.
test("item curto demais não casa por estar contido no termo", () => {
  const items = [item("de", 10, 700), item("UBS Central de Chapecó", 120, 400)];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "UBS Central de Chapecó" });
  assert.ok(pos);
  assert.ok(Math.abs(pos!.xPct - 120 / 600) < 0.01);
});

// Item em branco/espaço não deve virar âncora.
test("itens em branco são ignorados", () => {
  const items = [item("   ", 5, 790), item("Chapecó Central UBS", 200, 300)];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "   " });
  assert.equal(pos, null);
});

// Medido no memorial real 017_26: o pdfjs devolve "unidade básica de saúde"
// picado em itens. Sem juntar os vizinhos, 1 em cada 5 achados reais ficava sem
// pin. O pin cai no pedaço onde o trecho COMEÇA.
test("trecho quebrado entre itens ancora no primeiro pedaço", () => {
  const items = [
    item("Cabeçalho", 40, 770),
    item("unidade", 100, 500),
    item("básica", 160, 500),
    item("de saúde", 220, 500),
  ];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "unidade básica de saúde" });
  assert.ok(pos);
  assert.ok(Math.abs(pos!.xPct - 100 / 600) < 0.01);
  assert.ok(Math.abs(pos!.yPct - (1 - 500 / 800)) < 0.01);
});

// A junção não pode inventar casamento onde o texto não existe: pedaços de
// palavras diferentes não formam o trecho só por estarem lado a lado.
test("juntar vizinhos não inventa casamento", () => {
  const items = [item("unidade", 100, 500), item("de", 160, 500), item("ensino", 200, 500)];
  assert.equal(
    locateTermOnPage({ items, ...PAGE, termo: "unidade básica de saúde" }),
    null,
  );
});

// Coordenada fora da página (PDF com transform estranho) não pode gerar pin
// negativo nem > 1: a UI posiciona com percentual e sairia do quadro.
test("percentual fica preso entre 0 e 1", () => {
  const items = [item("UBS Central", -50, 2000)];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "UBS Central" });
  assert.ok(pos);
  assert.equal(pos!.xPct, 0);
  assert.equal(pos!.yPct, 0);
});

console.log(`\n${passed} testes ok`);
