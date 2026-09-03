/**
 * PROVA, contra o banco de verdade, que a auditoria órfã deixa de mentir.
 *
 * O teste unitário (`npm run test:batimento`) prova o JULGAMENTO com um relógio
 * de mentira. O que ele não pode provar é que a coluna existe, que o batimento
 * chega a ser escrito e que o fechamento não pisa em auditoria alheia — três
 * coisas que só o Postgres responde.
 *
 * NÃO GASTA MODELO: nenhuma auditoria roda aqui. As linhas são semeadas à mão
 * no estado exato que interessa e apagadas no fim.
 *
 *   node --import ./scripts/lib/resolver-de-imports.mjs \
 *     --env-file=.env.local scripts/prova-batimento-da-auditoria.mjs
 *   (== npm run prova:batimento)
 */
import assert from "node:assert/strict";

import { manterBatimento, marcarAuditoriaSemSinal } from "@/lib/audit-persistence";
import {
  MOTIVO_SEM_SINAL,
  SEM_SINAL_MS,
  auditoriaSemSinal,
} from "@/lib/batimento-da-auditoria";
import { getPrisma } from "@/lib/db";

const prisma = getPrisma();
const criados = [];
let passou = 0;

async function check(nome, fn) {
  try {
    await fn();
    passou++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

/** Semeia uma auditoria no estado pedido. Sem projeto e sem usuário: os dois são opcionais. */
async function semear({ status = "PROCESSING", batimentoHaMs = 0 }) {
  const id = `prova-batimento-${Math.random().toString(16).slice(2, 10)}`;
  await prisma.audit.create({
    data: {
      id,
      title: "Prova do batimento",
      projectName: "Prova do batimento",
      auditMode: "memorial",
      analysisLevel: "standard",
      status,
      heartbeatAt: new Date(Date.now() - batimentoHaMs),
    },
  });
  criados.push(id);
  return id;
}

const ler = (id) =>
  prisma.audit.findUniqueOrThrow({
    where: { id },
    select: { status: true, error: true, heartbeatAt: true, createdAt: true },
  });

await check("a coluna existe e guarda o batimento", async () => {
  const id = await semear({ batimentoHaMs: 1_000 });
  const linha = await ler(id);
  assert.ok(linha.heartbeatAt instanceof Date);
});

await check("batimento em dia: o banco confirma que está viva", async () => {
  const id = await semear({ batimentoHaMs: 5_000 });
  assert.equal(auditoriaSemSinal(await ler(id)), false);
});

await check("batimento parado: sem sinal, e o fechamento grava o motivo", async () => {
  const id = await semear({ batimentoHaMs: SEM_SINAL_MS + 60_000 });
  assert.equal(auditoriaSemSinal(await ler(id)), true);

  await marcarAuditoriaSemSinal(id);

  const depois = await ler(id);
  assert.equal(depois.status, "FAILED");
  assert.equal(depois.error, MOTIVO_SEM_SINAL);
  // E deixa de ser julgada: estado final não se reabre.
  assert.equal(auditoriaSemSinal(depois), false);
});

await check("fechar uma NÃO fecha a vizinha que está viva", async () => {
  /*
   * O risco real de um `updateMany`: condição frouxa fecharia toda auditoria em
   * curso do banco na primeira consulta de uma órfã.
   */
  const viva = await semear({ batimentoHaMs: 2_000 });
  const orfa = await semear({ batimentoHaMs: SEM_SINAL_MS + 60_000 });

  await marcarAuditoriaSemSinal(orfa);

  assert.equal((await ler(viva)).status, "PROCESSING");
  assert.equal((await ler(orfa)).status, "FAILED");
});

await check("auditoria com desfecho NÃO é reaberta pelo fechamento", async () => {
  const id = await semear({ status: "COMPLETED", batimentoHaMs: 90 * 3_600_000 });
  await marcarAuditoriaSemSinal(id);
  assert.equal((await ler(id)).status, "COMPLETED");
});

await check("manterBatimento ressuscita o sinal de uma linha parada", async () => {
  const id = await semear({ batimentoHaMs: SEM_SINAL_MS + 60_000 });
  assert.equal(auditoriaSemSinal(await ler(id)), true);

  const batimento = manterBatimento(id);
  // O primeiro batimento sai na chamada; só falta o banco confirmar.
  await new Promise((r) => setTimeout(r, 1_500));
  batimento.parar();

  const depois = await ler(id);
  assert.equal(auditoriaSemSinal(depois), false, "o batimento não chegou ao banco");
});

await check("manterBatimento NÃO ressuscita auditoria cancelada", async () => {
  /*
   * A aba que cancelou já fechou a linha; a que ficou pendurada no POST segue
   * batendo por mais alguns segundos. Se o batimento ignorasse o status, ele
   * mexeria numa auditoria que já tem desfecho.
   */
  const id = await semear({ status: "CANCELED", batimentoHaMs: 600_000 });
  const antes = (await ler(id)).heartbeatAt.getTime();

  const batimento = manterBatimento(id);
  await new Promise((r) => setTimeout(r, 1_500));
  batimento.parar();

  assert.equal((await ler(id)).heartbeatAt.getTime(), antes);
  assert.equal((await ler(id)).status, "CANCELED");
});

await prisma.audit.deleteMany({ where: { id: { in: criados } } });
const sobrou = await prisma.audit.count({ where: { id: { in: criados } } });
assert.equal(sobrou, 0, "a prova deixou lixo no banco");

console.log(`\n${passou} verificação(ões) de batimento OK — banco limpo`);
await prisma.$disconnect();
