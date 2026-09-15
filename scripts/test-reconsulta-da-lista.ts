/**
 * Quando a lista de conversas volta a ser pedida ao servidor (15/09/2026).
 *
 *   node scripts/test-reconsulta-da-lista.ts
 */
import assert from "node:assert/strict";

import {
  INTERVALO_DA_RECONSULTA_MS,
  deveReconsultarLista,
} from "../modules/nexo/lib/reconsulta-da-lista.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

test("lista que nunca chegou: pede de novo ao voltar a ficar visível, mesmo logo depois", () => {
  assert.equal(
    deveReconsultarLista({
      motivo: "visivel",
      carregada: false,
      ultimaIdaMs: 1000,
      agoraMs: 1001,
    }),
    true,
  );
});

test("a rede voltou: pede de novo mesmo com a lista carregada", () => {
  assert.equal(
    deveReconsultarLista({
      motivo: "online",
      carregada: true,
      ultimaIdaMs: 1000,
      agoraMs: 1001,
    }),
    true,
  );
});

test("lista carregada e pedida há pouco: voltar a ficar visível não pede de novo", () => {
  assert.equal(
    deveReconsultarLista({
      motivo: "visivel",
      carregada: true,
      ultimaIdaMs: 1000,
      agoraMs: 1000 + INTERVALO_DA_RECONSULTA_MS - 1,
    }),
    false,
  );
});

test("lista carregada e pedida há mais que o intervalo: pede de novo", () => {
  assert.equal(
    deveReconsultarLista({
      motivo: "visivel",
      carregada: true,
      ultimaIdaMs: 1000,
      agoraMs: 1000 + INTERVALO_DA_RECONSULTA_MS,
    }),
    true,
  );
});

console.log(`\n${passed} teste(s) passaram`);
