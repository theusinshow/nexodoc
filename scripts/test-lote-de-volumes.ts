/**
 * MONTAR VOLUMES EM LOTE CONFERE UMA VEZ SÓ — última onda da frente A, 15/09/2026.
 *
 * "Remontar e baixar" e "Montar os N volumes" chamam, por volume, o `confirm`
 * do cartão — e cada um fazia a sua ida ao servidor para conferir a versão antes
 * de gastar. N volumes, N perguntas iguais no mesmo gesto. Agora o lote confere
 * uma vez, recusa tudo de uma vez se estiver desatualizado, e passa
 * `jaConferido` a cada montagem.
 *
 *   node scripts/test-lote-de-volumes.ts
 */
import assert from "node:assert/strict";

import { montarEmLote } from "../modules/nexo/lib/lote-de-volumes.ts";

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

function volumes(n: number, resultado: (i: number) => string | null | Error) {
  const chamadas: { id: string; jaConferido: boolean }[] = [];
  const itens = Array.from({ length: n }, (_, i) => ({
    id: `v${i}`,
    rotulo: `TOMO ${i + 1}`,
    montar: async (opcoes?: { jaConferido?: boolean }) => {
      chamadas.push({ id: `v${i}`, jaConferido: opcoes?.jaConferido === true });
      const r = resultado(i);
      if (r instanceof Error) throw r;
      return r;
    },
  }));
  return { itens, chamadas };
}

await test("três volumes: uma conferência só, e cada montagem sabe que já foi conferida", async () => {
  const { itens, chamadas } = volumes(3, () => null);
  let conferencias = 0;
  const indices: number[] = [];
  const r = await montarEmLote({
    itens,
    conferir: async () => {
      conferencias++;
      return { pode: true };
    },
    aoComecar: (i) => indices.push(i),
  });
  assert.equal(conferencias, 1);
  assert.deepEqual(
    chamadas.map((c) => c.jaConferido),
    [true, true, true],
  );
  assert.deepEqual(indices, [0, 1, 2]);
  assert.deepEqual(r, {
    recusado: null,
    falhas: [],
    refeitos: ["v0", "v1", "v2"],
  });
});

await test("desatualizada: recusa o lote inteiro de uma vez, sem montar nenhum", async () => {
  const { itens, chamadas } = volumes(3, () => null);
  const r = await montarEmLote({
    itens,
    conferir: async () => ({ pode: false, motivo: "mudou em outra aba" }),
  });
  assert.equal(chamadas.length, 0);
  assert.deepEqual(r, {
    recusado: "mudou em outra aba",
    falhas: [],
    refeitos: [],
  });
});

await test("um volume que recusa ou explode não leva os outros; card sumido conta se pedir", async () => {
  const { itens } = volumes(3, (i) =>
    i === 0 ? "sem pranchas" : i === 1 ? new Error("quebrou") : null,
  );
  let conferencias = 0;
  const r = await montarEmLote({
    itens: [
      ...itens,
      {
        id: "v3",
        rotulo: "TOMO 4",
        montar: undefined,
        faltando: "o card não está mais na conversa",
      },
      { id: "v4", rotulo: "TOMO 5", montar: undefined },
    ],
    conferir: async () => {
      conferencias++;
      return { pode: true };
    },
  });
  assert.equal(conferencias, 1);
  assert.deepEqual(r.falhas, [
    { rotulo: "TOMO 1", motivo: "sem pranchas" },
    { rotulo: "TOMO 2", motivo: "quebrou" },
    { rotulo: "TOMO 4", motivo: "o card não está mais na conversa" },
  ]);
  assert.deepEqual(r.refeitos, ["v2"]);
});

await test("nenhum volume com montador: não pergunta nada ao servidor", async () => {
  let conferencias = 0;
  const r = await montarEmLote({
    itens: [{ id: "v0", rotulo: "TOMO 1", montar: undefined }],
    conferir: async () => {
      conferencias++;
      return { pode: true };
    },
  });
  assert.equal(conferencias, 0);
  assert.deepEqual(r, { recusado: null, falhas: [], refeitos: [] });
});

console.log(`\n${passed} ok`);
