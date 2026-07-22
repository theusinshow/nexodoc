/**
 * Smoke-test da NORMALIZAÇÃO do agente Nexo (parte determinística/pura do
 * roteador de intenção). Trava o mapeamento de prefeitura (tolerante a acento) e
 * os defaults das propostas — o que dá pra garantir sem chamar a IA.
 *
 *   node scripts/test-nexo-agent.ts   (== npm run test:nexo:agent)
 */
import assert from "node:assert/strict";

import {
  clampTomos,
  matchPrefeitura,
  normalizeProposals,
  type AgentPrefeitura,
} from "../server/nexo/agent/normalize.ts";

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

const PREFS: AgentPrefeitura[] = [
  { id: "prefchap", nome: "Chapecó — Padrão" },
  { id: "prefflor", nome: "Florianópolis" },
  { id: "prefcri", nome: "Criciúma" },
];

test("clampTomos: default 1, limita e piso", () => {
  assert.equal(clampTomos(undefined), 1);
  assert.equal(clampTomos(0), 1);
  assert.equal(clampTomos(-5), 1);
  assert.equal(clampTomos(3), 3);
  assert.equal(clampTomos("4"), 4);
  assert.equal(clampTomos(999), 99);
});

test("matchPrefeitura: id exato", () => {
  assert.equal(matchPrefeitura({ id: "prefcri" }, PREFS)?.id, "prefcri");
});

test("matchPrefeitura: sem acento (chapeco -> Chapecó)", () => {
  assert.equal(matchPrefeitura({ nome: "chapeco" }, PREFS)?.id, "prefchap");
});

test("matchPrefeitura: verboso (prefeitura de chapecó -> Chapecó)", () => {
  assert.equal(
    matchPrefeitura({ nome: "prefeitura de chapecó" }, PREFS)?.id,
    "prefchap",
  );
});

test("matchPrefeitura: sem correspondência -> null", () => {
  assert.equal(matchPrefeitura({ nome: "joinville" }, PREFS), null);
});

test("normalizeProposals: ld com defaults (titulo vazio, tomos 1)", () => {
  const r = normalizeProposals([{ kind: "ld" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, "ld");
  assert.equal((r[0].params as { tituloLd: string }).tituloLd, "");
  assert.equal((r[0].params as { numTomos: number }).numTomos, 1);
});

test("normalizeProposals: capa mapeia prefeitura pelo nome", () => {
  const r = normalizeProposals(
    [{ kind: "capa", prefeitura: "Chapecó", volume: "2", numTomos: 4 }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 1);
  const params = r[0].params as { templateId: string; volume: string; numTomos: number };
  assert.equal(params.templateId, "prefchap");
  assert.equal(params.volume, "2");
  assert.equal(params.numTomos, 4);
});

test("normalizeProposals: capa sem match cai no 1o template", () => {
  const r = normalizeProposals([{ kind: "capa", prefeitura: "xyz" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal((r[0].params as { templateId: string }).templateId, "prefchap");
});

test("normalizeProposals: volume não-numérico vira vazio", () => {
  const r = normalizeProposals([{ kind: "capa", prefeitura: "Criciúma", volume: "dois" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal((r[0].params as { volume: string }).volume, "");
});

test("normalizeProposals: kind inválido e não-array são ignorados", () => {
  assert.deepEqual(normalizeProposals("nao-array", { disciplina: "X", prefeituras: PREFS }), []);
  assert.deepEqual(
    normalizeProposals([{ kind: "foo" }, null, 3], { disciplina: "X", prefeituras: PREFS }),
    [],
  );
});

test("normalizeProposals: ld + capa juntas", () => {
  const r = normalizeProposals(
    [{ kind: "ld" }, { kind: "capa", prefeitura: "Florianópolis" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].kind, "ld");
  assert.equal(r[1].kind, "capa");
  assert.equal((r[1].params as { templateId: string }).templateId, "prefflor");
});

console.log(`\n${passed} teste(s) passaram.`);
