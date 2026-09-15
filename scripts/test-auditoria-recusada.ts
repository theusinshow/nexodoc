/**
 * Teste do DESCARTE da auditoria recusada antes de começar.
 *
 * Em 15/09/2026 a jornada a5 (documento idêntico) achou uma linha "Audit" presa
 * em PROCESSING para cada recusa: `createPendingAudit` roda antes da checagem, e
 * o `return` da recusa não a fechava. Ninguém a consulta depois — o bilhete é
 * limpo no cliente —, então ela ficava "rodando" para sempre no histórico.
 *
 *   node scripts/test-auditoria-recusada.ts
 */
import assert from "node:assert/strict";

import { descartarAuditoriaRecusada, type BancoDoDescarte } from "../lib/auditoria-recusada.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

function bancoDeMentira(opcoes: { falhar?: boolean } = {}) {
  const chamadas: { tabela: string; where: unknown }[] = [];
  const registrar = (tabela: string) => async (args: { where: unknown }) => {
    if (opcoes.falhar) throw new Error("banco fora do ar");
    chamadas.push({ tabela, where: args.where });
    return { count: 1 };
  };
  const db = {
    audit: { deleteMany: registrar("audit") },
    projectEvent: { deleteMany: registrar("projectEvent") },
  } as unknown as BancoDoDescarte;
  return { db, chamadas };
}

await test("apaga o evento 'Auditoria criada' e a linha PROCESSING daquele id", async () => {
  const { db, chamadas } = bancoDeMentira();
  const r = await descartarAuditoriaRecusada(db, "aud-12345678");
  assert.deepEqual(chamadas, [
    { tabela: "projectEvent", where: { type: "AUDIT_CREATED", details: { path: ["auditId"], equals: "aud-12345678" } } },
    { tabela: "audit", where: { id: "aud-12345678", status: "PROCESSING" } },
  ]);
  assert.deepEqual(r, { auditorias: 1, eventos: 1 });
});

await test("sem id (ambiente sem banco) não toca em nada", async () => {
  const { db, chamadas } = bancoDeMentira();
  assert.deepEqual(await descartarAuditoriaRecusada(db, null), { auditorias: 0, eventos: 0 });
  assert.deepEqual(chamadas, []);
});

await test("falha do banco não derruba a recusa que vai para a tela", async () => {
  const { db } = bancoDeMentira({ falhar: true });
  assert.deepEqual(await descartarAuditoriaRecusada(db, "aud-12345678"), { auditorias: 0, eventos: 0 });
});

console.log(`\n${passed} teste(s) passaram`);
