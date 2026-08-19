/**
 * O PORTÃO da prefeitura, antes de gerar.
 *
 *   node scripts/test-coerencia-do-volume.ts   (== npm run test:nexo:coerencia)
 */
import assert from "node:assert/strict";

import { conferirPrefeitura } from "../modules/nexo/lib/coerencia-do-volume.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("coerência do volume\n");

test("todos concordando passa", () => {
  assert.equal(
    conferirPrefeitura([
      { rotulo: "Capa", templateId: "pmcriciuma" },
      { rotulo: "Separatriz", templateId: "pmcriciuma" },
    ]),
    null,
  );
});

test("divergência é recusada e DIZ quem discorda", () => {
  const p = conferirPrefeitura([
    { rotulo: "Capa", templateId: "pmcriciuma" },
    { rotulo: "Separatriz", templateId: "prefchap" },
  ]);
  assert.equal(p?.tipo, "divergente");
  // A frase precisa nomear os DOIS lados: "os documentos discordam" sem dizer
  // quais manda o engenheiro abrir tudo para achar o errado.
  assert.match(p!.mensagem, /Capa/);
  assert.match(p!.mensagem, /Separatriz/);
  assert.match(p!.mensagem, /pmcriciuma/);
  assert.match(p!.mensagem, /prefchap/);
});

test("prefeitura vazia trava o volume INTEIRO", () => {
  const p = conferirPrefeitura([
    { rotulo: "Capa", templateId: "" },
    { rotulo: "Separatriz", templateId: "" },
  ]);
  assert.equal(p?.tipo, "vazia");
});

test("um só documento vazio trava igual", () => {
  const p = conferirPrefeitura([
    { rotulo: "Capa", templateId: "pmcriciuma" },
    { rotulo: "Separatriz", templateId: "" },
  ]);
  assert.equal(p?.tipo, "vazia");
});

test("lista sem documento de prefeitura não trava nada", () => {
  // Uma LD sozinha não imprime brasão: não há o que conferir.
  assert.equal(conferirPrefeitura([]), null);
});

test("espaço em branco conta como vazio", () => {
  const p = conferirPrefeitura([{ rotulo: "Capa", templateId: "   " }]);
  assert.equal(p?.tipo, "vazia");
});

console.log(`\n${passed} teste(s) passaram.`);
