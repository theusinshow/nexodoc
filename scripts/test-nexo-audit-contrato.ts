/**
 * Teste do CONTRATO entre `/api/audit` e quem consome a auditoria no Nexo.
 *
 * A rota responde `{ result, report, auditId }`, onde `result` é o parecer em
 * TEXTO e `report` é o objeto. O cliente lia `result` e o declarava `AuditReport`
 * com um `as` — então gravava uma string onde o relatório deveria estar, e a tela
 * quebrava ao contar os achados. `tsc` não enxerga através de um `as`, e nenhum
 * teste casava os dois lados: por isso o defeito sobreviveu.
 *
 * Aqui o `fetch` é dublê e devolve exatamente o formato da rota.
 *
 *   node scripts/test-nexo-audit-contrato.ts   (== npm run test:nexo:audit-contrato)
 */
import assert from "node:assert/strict";

import { runMemorialAudit } from "../modules/nexo/lib/audit.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

/** O relatório mínimo com os campos que a tela realmente lê. */
const REPORT = {
  obra: "Centro Comunitário Primeira Linha",
  status_geral: "com pontos críticos",
  total_incongruencias: 2,
  conclusao: "Memorial cita obra diferente da declarada.",
  incongruencias: [
    { id: "INC-001", prioridade: "alta", descricao: "Obra divergente" },
    { id: "INC-002", prioridade: "media", descricao: "Área divergente" },
  ],
} as const;

/** A resposta como a rota a monta em `route.ts` (`{ result, report, ... }`). */
const RESPOSTA_DA_ROTA = {
  result: "# Relatório\n\nMemorial cita obra diferente…",
  report: REPORT,
  auditMode: "memorial",
  auditId: "aud_123",
};

function dublarFetch(status: number, corpo: unknown) {
  globalThis.fetch = (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => corpo,
    }) as unknown as Response) as typeof fetch;
}

const memorial = new File([new Uint8Array([1, 2, 3])], "017_26_md.pdf", {
  type: "application/pdf",
});

await test("devolve o RELATÓRIO (objeto), não o texto", async () => {
  dublarFetch(200, RESPOSTA_DA_ROTA);
  const r = await runMemorialAudit(memorial);
  assert.equal(typeof r.report, "object");
  assert.equal(r.report.total_incongruencias, 2);
  // O sintoma exato do bug: a tela conta os achados e explode numa string.
  assert.equal(r.report.incongruencias.length, 2);
});

await test("preserva o texto e o id, que destravam exportar e feedback", async () => {
  dublarFetch(200, RESPOSTA_DA_ROTA);
  const r = await runMemorialAudit(memorial);
  assert.match(r.texto, /Relatório/);
  assert.equal(r.auditId, "aud_123");
});

await test("resposta sem `report` é falha, mesmo com `result` presente", async () => {
  dublarFetch(200, { result: "texto solto" });
  await assert.rejects(() => runMemorialAudit(memorial), /Falha na auditoria/);
});

await test("erro da rota vira a mensagem da rota", async () => {
  dublarFetch(400, { error: "Memorial ilegível." });
  await assert.rejects(() => runMemorialAudit(memorial), /Memorial ilegível/);
});

console.log(`\n${passed} teste(s) passaram.`);
