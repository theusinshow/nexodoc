/**
 * O QUE FALTA RECUPERAR do servidor, depois de restaurar a conversa.
 *
 * O parecer é gravado no Postgres pelo BACKEND (`persistCompletedAudit`), por
 * fora de qualquer gravação do cliente. Então mesmo quando a conversa volta sem
 * ele, o trabalho pago existe — falta saber POR QUAL id pedi-lo.
 *
 * E falta o cuidado que separa recuperação de teimosia: não ressuscitar o que a
 * pessoa apagou de propósito.
 *
 *   node scripts/test-parecer-a-recuperar.ts   (== npm run test:parecer-a-recuperar)
 */
import assert from "node:assert/strict";

import {
  parecerARecuperar,
  type RegistroParaRecuperar,
} from "../modules/nexo/lib/parecer-a-recuperar.ts";

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

const REGISTRADA = { auditId: "a-1", artifactId: "auditoria:1" };

test("auditoria registrada e artefato ausente → recupera", () => {
  const rec: RegistroParaRecuperar = { results: [], auditorias: [REGISTRADA] };
  assert.deepEqual(parecerARecuperar(rec), REGISTRADA);
});

test("o parecer já está lá → nada a fazer", () => {
  const rec: RegistroParaRecuperar = {
    results: [{ artifactId: "auditoria:1", kind: "auditoria" }],
    auditorias: [REGISTRADA],
  };
  assert.equal(parecerARecuperar(rec), null);
});

test("APAGAR CONTINUA SENDO APAGAR — não ressuscita o excluído", () => {
  /*
   * Sem esta guarda, o parecer que a pessoa excluiu voltaria em TODA abertura.
   * Um produto que desfaz a exclusão do usuário é pior que um que perde o
   * arquivo, porque o primeiro faz isso para sempre.
   */
  const rec: RegistroParaRecuperar = {
    results: [],
    auditorias: [REGISTRADA],
    artefatosApagados: ["auditoria:1"],
  };
  assert.equal(parecerARecuperar(rec), null);
});

test("conversa antiga, sem os campos — não quebra e não inventa", () => {
  assert.equal(parecerARecuperar({ results: [] }), null);
});

test("duas auditorias, uma faltando → devolve a que falta", () => {
  const outra = { auditId: "a-2", artifactId: "auditoria:2" };
  const rec: RegistroParaRecuperar = {
    results: [{ artifactId: "auditoria:1", kind: "auditoria" }],
    auditorias: [REGISTRADA, outra],
  };
  assert.deepEqual(parecerARecuperar(rec), outra);
});

test("artefato de OUTRO tipo com o mesmo id não conta como parecer", () => {
  const rec: RegistroParaRecuperar = {
    results: [{ artifactId: "auditoria:1", kind: "capa" }],
    auditorias: [REGISTRADA],
  };
  assert.deepEqual(parecerARecuperar(rec), REGISTRADA);
});

console.log(`\n${passed} teste(s) de parecer a recuperar OK`);
