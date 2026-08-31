/**
 * A LEITURA DE SELO NÃO PODE PARAR QUANDO A ABA VAI PARA TRÁS.
 *
 * O pdf.js agenda a CONTINUAÇÃO do desenho com `requestAnimationFrame` quando o
 * intent é de tela, e o Chrome não roda rAF em aba de segundo plano: a promessa
 * do `render()` ficava pendurada, as três leituras simultâneas presas nela, e a
 * análise de pranchas congelava até a aba voltar à frente — sem erro e sem
 * aviso. Ver `modules/nexo/lib/selo-render-crop.ts`.
 *
 * Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-render-em-segundo-plano.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { semRequestAnimationFrame } from "../modules/nexo/lib/selo-render-crop.ts";

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

test("desliga o rAF da tarefa de render", () => {
  const task = {
    promise: Promise.resolve(),
    _internalRenderTask: { _useRequestAnimationFrame: true },
  };
  semRequestAnimationFrame(task);
  assert.equal(
    task._internalRenderTask._useRequestAnimationFrame,
    false,
    "sem isto o desenho só continua quando a aba está visível",
  );
});

test("devolve a MESMA tarefa (a promessa não pode se perder)", () => {
  const task = { promise: Promise.resolve(), _internalRenderTask: {} };
  assert.equal(semRequestAnimationFrame(task), task);
});

test("tarefa sem o campo interno não quebra", () => {
  const task = { promise: Promise.resolve() };
  assert.equal(semRequestAnimationFrame(task), task);
});

/*
 * O COMBINADO COM A BIBLIOTECA.
 *
 * `_internalRenderTask` e `_useRequestAnimationFrame` são internos do pdf.js.
 * Se um upgrade os renomear, o desenho continua CERTO — só volta a congelar em
 * segundo plano, calado, que é exatamente o defeito que se está consertando.
 * Este teste é o alarme desse dia.
 */
test("o pdf.js instalado ainda tem os campos em que este conserto se apoia", () => {
  const require_ = createRequire(import.meta.url);
  const fonte = readFileSync(
    require_.resolve("pdfjs-dist/legacy/build/pdf.mjs"),
    "utf8",
  );
  assert.ok(
    fonte.includes("_internalRenderTask = null"),
    "RenderTask não expõe mais `_internalRenderTask`",
  );
  assert.ok(
    fonte.includes("this._useRequestAnimationFrame = useRequestAnimationFrame"),
    "InternalRenderTask não guarda mais `_useRequestAnimationFrame`",
  );
  assert.ok(
    fonte.includes("useRequestAnimationFrame: !intentPrint"),
    "o render de tela não usa mais rAF — talvez o conserto já não seja preciso",
  );
});

console.log(`\n${passed} testes ok`);
