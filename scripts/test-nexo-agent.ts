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

// --- PR4: novos kinds (separatriz | auditoria | conferencia | volume) -------

test("normalizeProposals: separatriz casa prefeitura e clampa tomos", () => {
  const r = normalizeProposals(
    [{ kind: "separatriz", prefeitura: "chapeco", numTomos: 999 }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, "separatriz");
  const params = r[0].params as { templateId: string; numTomos: number };
  assert.equal(params.templateId, "prefchap");
  assert.equal(params.numTomos, 99); // clampTomos limita a 99
  // separatriz não tem volume (só templateId + numTomos).
  assert.deepEqual(Object.keys(params).sort(), ["numTomos", "templateId"]);
});

test("normalizeProposals: separatriz sem match cai no 1o template", () => {
  const r = normalizeProposals([{ kind: "separatriz", prefeitura: "xyz" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal((r[0].params as { templateId: string }).templateId, "prefchap");
});

test("normalizeProposals: auditoria nivel 'deep' é preservado", () => {
  const r = normalizeProposals([{ kind: "auditoria", nivel: "deep" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, "auditoria");
  assert.equal((r[0].params as { nivel: string }).nivel, "deep");
});

test("normalizeProposals: auditoria nivel inválido/ausente -> 'standard'", () => {
  const r = normalizeProposals(
    [{ kind: "auditoria", nivel: "xyz" }, { kind: "auditoria" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 2);
  assert.equal((r[0].params as { nivel: string }).nivel, "standard");
  assert.equal((r[1].params as { nivel: string }).nivel, "standard");
});

test("normalizeProposals: conferencia e volume normalizam com params vazio", () => {
  const r = normalizeProposals(
    [{ kind: "conferencia" }, { kind: "volume" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].kind, "conferencia");
  assert.equal(r[1].kind, "volume");
  assert.deepEqual(r[0].params, {});
  assert.deepEqual(r[1].params, {});
});

test("normalizeProposals: kind desconhecido continua ignorado (degrada gracioso)", () => {
  const r = normalizeProposals(
    [{ kind: "separatriz", prefeitura: "Chapecó" }, { kind: "quimera" }, { kind: "volume" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  // só separatriz + volume; "quimera" some.
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((p) => p.kind), ["separatriz", "volume"]);
});

// Trava a FORMA dos params de ld e capa. A capa ganhou `tituloCapa` quando o
// título virou decisão do engenheiro (antes a capa não tinha título nenhum, e
// pedir "altere o título da capa" não tinha onde pousar). Fora isso, intocados.
test("normalizeProposals: forma dos params de ld e capa (regressão)", () => {
  const r = normalizeProposals(
    [
      { kind: "ld", tituloLd: "BLOCO B", numTomos: 2 },
      { kind: "capa", prefeitura: "Criciúma", volume: "3", numTomos: 2 },
    ],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].params, { tituloLd: "BLOCO B", numTomos: 2 });
  assert.deepEqual(r[1].params, {
    templateId: "prefcri",
    tituloCapa: "", // não veio no pedido → decisão pendente, o Nexo pergunta
    volume: "3",
    numTomos: 2,
  });
});

test("normalizeProposals: tituloCapa dito pelo engenheiro é copiado tal e qual", () => {
  const r = normalizeProposals(
    [
      {
        kind: "capa",
        prefeitura: "Criciúma",
        tituloCapa: "PROJETO ESTRUTURAL CONCRETO\nIMPLANTAÇÃO",
        volume: "6",
      },
    ],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(
    (r[0].params as { tituloCapa: string }).tituloCapa,
    "PROJETO ESTRUTURAL CONCRETO\nIMPLANTAÇÃO",
    "título multilinha chega inteiro, sem mistura com o anterior",
  );
});

console.log(`\n${passed} teste(s) passaram.`);
