// O canvas da auditoria no TECLADO e no leitor de tela.
//
//   node scripts/test-nexo-canvas-teclado.ts   (== npm run test:nexo:canvas-teclado)
//
// POR QUE ESTE TESTE EXISTE
//
// A onda 1 do canvas (045197b) escondeu o pin do leitor de tela com este
// argumento: "é afordância REDUNDANTE, tudo o que o pin faz o card também faz, e
// o card é focalizável e anunciado". A primeira metade era verdade, a segunda
// não:
//
//  · FOCALIZÁVEL, sim -- o React Flow 12.11.2 põe `tabIndex=0` e `role="group"`
//    no envoltório do nó;
//  · ANUNCIADO, não -- o canvas nunca preenchia `node.ariaLabel`, então o leitor
//    de tela lia "grupo" e o texto solto de dentro;
//  · e ENTER NÃO ABRIA NADA. O `onKeyDown` da biblioteca chama
//    `handleNodeClick({ id, store, unselect, nodeRef })`, que SELECIONA o nó e
//    não repassa o `onNodeClick` da aplicação. Conferido na fonte.
//
// O canvas inteiro não roda em node cru (React Flow, PDF, DOM), mas as duas
// coisas que decidem a resposta rodam: o TEXTO que o leitor anuncia e a TECLA
// que abre. São estas.
import assert from "node:assert/strict";

import {
  abreNoTeclado,
  rotuloDaPagina,
  rotuloDaPilha,
  rotuloDoAchado,
} from "../modules/nexo/lib/rotulo-do-no.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

// --- O que o leitor de tela anuncia ao chegar num card -----------------------

test("o achado diz severidade, tipo e página", () => {
  assert.equal(
    rotuloDoAchado({
      tipo: "Numeração de itens",
      severity: "critico",
      tier: "achado",
      pageNumber: 12,
    }),
    "Achado crítico: Numeração de itens, página 12",
  );
});

/*
 * A SUGESTÃO SE ANUNCIA COMO SUGESTÃO. Na tela ela ganha uma tarja; quem ouve a
 * tela não tem tarja, e um achado rebaixado lido como achado vira o defeito que
 * a validação existe para evitar.
 */
test("a sugestão não se anuncia como achado", () => {
  assert.match(
    rotuloDoAchado({
      tipo: "Redação",
      severity: "editorial",
      tier: "sugestao",
      pageNumber: 3,
    }),
    /^Sugestão editorial:/,
  );
});

test("sem página, ele diz que não tem", () => {
  assert.match(
    rotuloDoAchado({ tipo: "Redação", severity: "editorial", tier: "achado" }),
    /sem página localizada$/,
  );
});

test("a disciplina entra quando existe", () => {
  assert.match(
    rotuloDoAchado({
      tipo: "Cota divergente",
      severity: "tecnico",
      tier: "achado",
      pageNumber: 8,
      disciplina: "estrutural",
    }),
    /estrutural$/,
  );
});

// --- A pilha do recorrente ---------------------------------------------------

/*
 * A PILHA É OUTRO OBJETO, e o rótulo tem de dizer isso: é o mesmo erro em várias
 * páginas, e o número de páginas É a informação. "Achado crítico: Numeração"
 * repetido cinco vezes esconderia justamente o que a pilha existe para mostrar.
 */
test("a pilha anuncia o alcance do erro", () => {
  const rotulo = rotuloDaPilha({
    tipo: "Numeração de itens",
    severity: "critico",
    count: 5,
    pages: [3, 7, 14, 22, 28],
  });
  assert.match(rotulo, /5 páginas/);
  assert.match(rotulo, /Numeração de itens/);
});

test("uma pilha de duas páginas fala no plural certo", () => {
  assert.match(
    rotuloDaPilha({ tipo: "Cota", severity: "tecnico", count: 2, pages: [4, 9] }),
    /2 páginas/,
  );
});

// --- A página do memorial ----------------------------------------------------

test("a página diz quantos achados carrega", () => {
  assert.equal(rotuloDaPagina({ pageNumber: 12, achados: 3 }), "Página 12 do memorial, 3 achados");
});

test("e no singular quando é um só", () => {
  assert.match(rotuloDaPagina({ pageNumber: 4, achados: 1 }), /1 achado$/);
});

// --- A tecla que abre --------------------------------------------------------

/*
 * ENTER E ESPAÇO, que são as duas teclas que ativam um controle na web. Não
 * incluir a seta: com `nodesDraggable={false}` ela não move nada, mas o React
 * Flow ainda a usa, e roubar seta de quem navega no canvas seria pior do que o
 * problema que estamos consertando.
 */
test("Enter abre", () => {
  assert.equal(abreNoTeclado("Enter"), true);
});

test("Espaço abre", () => {
  assert.equal(abreNoTeclado(" "), true);
});

test("as setas NÃO abrem", () => {
  assert.equal(abreNoTeclado("ArrowDown"), false);
  assert.equal(abreNoTeclado("Escape"), false);
  assert.equal(abreNoTeclado("Tab"), false);
});

console.log(`\n${passed} teste(s) passaram.`);
