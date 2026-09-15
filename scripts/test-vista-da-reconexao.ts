/**
 * O que o palco mostra da RETOMADA de uma auditoria (15/09/2026, jornada x3).
 *
 * No 403 (acesso suspenso) o bilhete fica guardado, para o acesso que voltar
 * reconectar à análise. Mas o palco escolhe "análise em curso" sempre que há
 * bilhete, antes de olhar a falha: a tela ficava em "em curso" para sempre, sem
 * perguntar e sem dizer por quê, e não havia como sair.
 *
 *   node scripts/test-vista-da-reconexao.ts
 */
import assert from "node:assert/strict";

import { vistaDaReconexao } from "../modules/nexo/lib/vista-da-reconexao.ts";

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

const bilhete = { auditId: "a1" };

test("bilhete sem bloqueio: mostra a espera, sem falha nem descarte", () => {
  assert.deepEqual(
    vistaDaReconexao({ bilhete, semAcesso: null, falha: null }),
    {
      mostrarPendente: true,
      falha: null,
      podeDescartar: false,
    },
  );
});

test("sem acesso para ESTE bilhete: não mostra a espera, mostra o motivo e deixa descartar", () => {
  assert.deepEqual(
    vistaDaReconexao({
      bilhete,
      semAcesso: { auditId: "a1", motivo: "Sem escritório." },
      falha: "Sem escritório.",
    }),
    { mostrarPendente: false, falha: "Sem escritório.", podeDescartar: true },
  );
});

test("sem acesso de OUTRO bilhete não esconde a espera deste", () => {
  assert.deepEqual(
    vistaDaReconexao({
      bilhete,
      semAcesso: { auditId: "velho", motivo: "Sem escritório." },
      falha: null,
    }),
    { mostrarPendente: true, falha: null, podeDescartar: false },
  );
});

test("falha comum (bilhete já saiu): mostra a falha, sem descarte", () => {
  assert.deepEqual(
    vistaDaReconexao({ bilhete: null, semAcesso: null, falha: "FAILED" }),
    {
      mostrarPendente: false,
      falha: "FAILED",
      podeDescartar: false,
    },
  );
});

console.log(`\n${passed} teste(s) passaram`);
