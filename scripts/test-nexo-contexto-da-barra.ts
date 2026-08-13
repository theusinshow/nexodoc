/**
 * O que a BARRA DO TOPO pode afirmar sobre a obra.
 *
 * A regra que se prova aqui é a precedência: engenheiro > carimbo > vazio. E a
 * regra que mais importa é a última — sem obra, a função devolve `null`, e é
 * isso que faz a barra não existir em vez de existir vazia dizendo que não sabe
 * de nada.
 *
 *   node scripts/test-nexo-contexto-da-barra.ts   (== npm run test:nexo:contexto-barra)
 */
import assert from "node:assert/strict";

import { contextoDaBarra } from "../modules/nexo/lib/contexto-da-barra.ts";
import type { SeloResult } from "../modules/nexo/lib/selo-render.ts";

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

/** Um selo com só o que este teste precisa; o resto é casca vazia. */
function selo(patch: Partial<NonNullable<SeloResult["extraction"]>>): SeloResult {
  return {
    fileName: "ARQ-01.pdf",
    pageNumber: 1,
    pageCount: 1,
    extraction: {
      disciplina: null,
      folha: null,
      total: null,
      numeroFolha: null,
      arquivo: null,
      conteudo: null,
      cliente: null,
      secretaria: null,
      obra: null,
      fase: null,
      tituloSecao: null,
      data: null,
      logoOrgao: null,
      confianca: "alta",
      ...patch,
    },
  };
}

// ---------------------------------------------------------------------------
// Ausência: a barra não nasce
// ---------------------------------------------------------------------------

test("sem identidade e sem selo, não há o que afirmar", () => {
  assert.equal(contextoDaBarra({ identidade: {}, seloResults: [] }), null);
});

test("selo lido mas sem obra também não basta", () => {
  assert.equal(
    contextoDaBarra({ identidade: {}, seloResults: [selo({ cliente: "PREFEITURA DE XANXERÊ" })] }),
    null,
  );
});

test("obra só de espaços não é obra", () => {
  assert.equal(contextoDaBarra({ identidade: { obra: "   " }, seloResults: [] }), null);
});

// ---------------------------------------------------------------------------
// Precedência: engenheiro > carimbo
// ---------------------------------------------------------------------------

test("sem correção, a obra vem do carimbo", () => {
  const r = contextoDaBarra({
    identidade: {},
    seloResults: [selo({ obra: "ESCOLA MUNICIPAL JARDIM MARISTELA" })],
  });
  assert.equal(r?.obra, "ESCOLA MUNICIPAL JARDIM MARISTELA");
});

test("a correção do engenheiro vence o carimbo", () => {
  const r = contextoDaBarra({
    identidade: { obra: "CRECHE JARDIM MARISTELA" },
    seloResults: [selo({ obra: "ESCOLA MUNICIPAL JARDIM MARISTELA" })],
  });
  assert.equal(r?.obra, "CRECHE JARDIM MARISTELA");
});

test("o órgão segue a mesma precedência", () => {
  const r = contextoDaBarra({
    identidade: { obra: "CRECHE X", orgao: "PREFEITURA MUNICIPAL DE CHAPECÓ" },
    seloResults: [selo({ obra: "CRECHE X", cliente: "PREF. CHAPECO" })],
  });
  assert.equal(r?.orgao, "PREFEITURA MUNICIPAL DE CHAPECÓ");
});

test("sem correção, o órgão vem do cliente do carimbo", () => {
  const r = contextoDaBarra({
    identidade: {},
    seloResults: [selo({ obra: "CRECHE X", cliente: "PREFEITURA MUNICIPAL DE CHAPECÓ" })],
  });
  assert.equal(r?.orgao, "PREFEITURA MUNICIPAL DE CHAPECÓ");
});

test("sem cliente, o brasão responde pelo órgão", () => {
  const r = contextoDaBarra({
    identidade: {},
    seloResults: [selo({ obra: "CRECHE X", logoOrgao: "PREFEITURA MUNICIPAL DE SEARA" })],
  });
  assert.equal(r?.orgao, "PREFEITURA MUNICIPAL DE SEARA");
});

test("obra sem órgão nenhum: a barra existe, o órgão não", () => {
  const r = contextoDaBarra({ identidade: { obra: "CRECHE X" }, seloResults: [] });
  assert.deepEqual(r, { obra: "CRECHE X" });
});

// ---------------------------------------------------------------------------
// O código da obra
// ---------------------------------------------------------------------------

/*
 * O código DERIVADO sai como o nome de arquivo o escreve — "063-26", com hífen.
 * O campo ditado à mão usa underscore ("040_26", ver o exemplo em
 * `identidade.ts`). A barra não uniformiza os dois de propósito: ela mostra o
 * mesmo código que a pasta da lateral mostra, e uniformizar aqui faria as duas
 * discordarem sobre a mesma obra.
 */
test("o código sai do nome de arquivo dos selos, como a pasta da lateral", () => {
  const r = contextoDaBarra({
    identidade: {},
    seloResults: [{ ...selo({ obra: "CRECHE X", arquivo: "063-26-ARQ-01" }) }],
  });
  assert.equal(r?.codigo, "063-26");
});

test("o código corrigido à mão vence o derivado", () => {
  const r = contextoDaBarra({
    identidade: { obra: "CRECHE X", codigo: "040_26" },
    seloResults: [{ ...selo({ obra: "CRECHE X", arquivo: "063-26-ARQ-01" }) }],
  });
  assert.equal(r?.codigo, "040_26");
});

// ---------------------------------------------------------------------------
// Aparar
// ---------------------------------------------------------------------------

test("os valores saem aparados", () => {
  const r = contextoDaBarra({
    identidade: { obra: "  CRECHE X  ", orgao: "  PREF X  " },
    seloResults: [],
  });
  assert.deepEqual(r, { obra: "CRECHE X", orgao: "PREF X" });
});

console.log(`\n${passed} teste(s) passaram.`);
