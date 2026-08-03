/**
 * Teste da IDENTIDADE DO PROJETO dita à mão — o escape de quando o carimbo mente.
 *
 * Duas coisas se provam aqui: que a correção ACUMULA e se desfaz campo a campo,
 * e que ela não se mistura com os params do documento. A segunda é a que evita o
 * defeito silencioso: identidade guardada junto dos params duraria só até a
 * próxima geração pelo plano, que os reconstrói a partir da proposta do agente —
 * a correção seria aceita e revertida sem aviso.
 *
 * A precedência (a correção VENCE o carimbo) vive nos dois construtores do
 * servidor, que não rodam em node cru. Ela é exercitada no navegador, em
 * `scripts/shot-nexo-identidade.mjs`.
 *
 *   node scripts/test-nexo-identidade.ts   (== npm run test:nexo:identidade)
 */
import assert from "node:assert/strict";

import {
  CAMPOS_DA_IDENTIDADE,
  aplicarIdentidade,
  limparIdentidade,
  separarIdentidade,
} from "../modules/nexo/lib/identidade.ts";

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
// O que conta como correção
// ---------------------------------------------------------------------------

test("campo em branco não é correção — é o carimbo de volta", () => {
  assert.deepEqual(limparIdentidade({ obra: "   ", codigo: "" }), {});
});

test("limparIdentidade fica só com o que tem conteúdo, aparado", () => {
  assert.deepEqual(limparIdentidade({ obra: "  ESCOLA X  ", fase: "" }), {
    obra: "ESCOLA X",
  });
});

test("os seis campos são os da capa — nenhum a mais entra", () => {
  assert.deepEqual([...CAMPOS_DA_IDENTIDADE], [
    "orgao",
    "secretaria",
    "obra",
    "fase",
    "codigo",
    "revisao",
  ]);
  // Chave estranha não vira identidade só por estar no formulário.
  assert.deepEqual(
    limparIdentidade({ obra: "X", tituloCapa: "NAO" } as never),
    { obra: "X" },
  );
});

// ---------------------------------------------------------------------------
// Acumular e desfazer
// ---------------------------------------------------------------------------

test("corrigir um campo não apaga os outros", () => {
  const antes = { obra: "ESCOLA X", codigo: "040_26" };
  assert.deepEqual(aplicarIdentidade(antes, { revisao: "b" }), {
    obra: "ESCOLA X",
    codigo: "040_26",
    revisao: "b",
  });
});

test("campo vazio DESFAZ aquele campo e mantém o resto", () => {
  const antes = { obra: "ESCOLA X", codigo: "040_26" };
  assert.deepEqual(aplicarIdentidade(antes, { obra: "" }), { codigo: "040_26" });
});

test("aplicarIdentidade não muta o que recebeu", () => {
  const antes = { obra: "ESCOLA X" };
  aplicarIdentidade(antes, { obra: "OUTRA" });
  assert.equal(antes.obra, "ESCOLA X");
});

test("chave ausente do patch não mexe no campo (só a vazia desfaz)", () => {
  const antes = { obra: "ESCOLA X" };
  assert.deepEqual(aplicarIdentidade(antes, { codigo: "040_26" }), {
    obra: "ESCOLA X",
    codigo: "040_26",
  });
});

// ---------------------------------------------------------------------------
// A separação que impede a reversão silenciosa
// ---------------------------------------------------------------------------

test("separarIdentidade divide o que é da conversa do que é do documento", () => {
  const { identidade, resto } = separarIdentidade({
    tituloCapa: "PROJETO HIDROSSANITARIO",
    numTomos: "2",
    obra: "ESCOLA X",
    revisao: "b",
  });
  assert.deepEqual(identidade, { obra: "ESCOLA X", revisao: "b" });
  assert.deepEqual(resto, { tituloCapa: "PROJETO HIDROSSANITARIO", numTomos: "2" });
});

test("sem campo de identidade, nada é desviado do documento", () => {
  const { identidade, resto } = separarIdentidade({ tituloCapa: "X", volume: "3" });
  assert.deepEqual(identidade, {});
  assert.deepEqual(resto, { tituloCapa: "X", volume: "3" });
});

test("o campo VAZIO de identidade atravessa a separação (é ele que desfaz)", () => {
  // Se `separarIdentidade` filtrasse vazios, apagar a correção seria impossível:
  // o patch chegaria sem a chave e `aplicarIdentidade` não mexeria no campo.
  const { identidade } = separarIdentidade({ obra: "" });
  assert.deepEqual(identidade, { obra: "" });
  assert.deepEqual(aplicarIdentidade({ obra: "VELHA" }, identidade), {});
});

console.log(`\n${passed} teste(s) OK`);
