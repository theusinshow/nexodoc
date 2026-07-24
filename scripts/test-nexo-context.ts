/**
 * Smoke-test do contexto do agente (popover de status do orb): dominância de
 * obra/código/revisão, disciplinas distintas em ordem, e conservadorismo
 * (null quando incerto). Núcleo PURO sem imports → roda com node cru.
 *
 *   node scripts/test-nexo-context.ts   (== npm run test:nexo:context)
 */
import assert from "node:assert/strict";

import { summarizeSelos, type SeloFacts } from "../modules/nexo/lib/agent-context.ts";

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

const selo = (o: Partial<SeloFacts>): SeloFacts => ({
  fileName: "",
  arquivo: null,
  disciplina: null,
  obra: null,
  ...o,
});

test("vazio -> tudo neutro", () => {
  const c = summarizeSelos([]);
  assert.equal(c.folhas, 0);
  assert.equal(c.obra, null);
  assert.deepEqual(c.disciplinas, []);
  assert.equal(c.codigo, null);
  assert.equal(c.revisao, null);
});

test("conta folhas = nº de selos", () => {
  assert.equal(summarizeSelos([selo({}), selo({}), selo({})]).folhas, 3);
});

test("obra dominante (empate -> primeira vista)", () => {
  const c = summarizeSelos([
    selo({ obra: "Escola A" }),
    selo({ obra: "Escola B" }),
    selo({ obra: "Escola A" }),
  ]);
  assert.equal(c.obra, "Escola A");
});

test("disciplinas distintas na ordem de aparição", () => {
  const c = summarizeSelos([
    selo({ disciplina: "Estrutural" }),
    selo({ disciplina: "Incêndio" }),
    selo({ disciplina: "Estrutural" }),
  ]);
  assert.deepEqual(c.disciplinas, ["Estrutural", "Incêndio"]);
});

test("código do padrão do escritório (arquivo do selo)", () => {
  const c = summarizeSelos([
    selo({ arquivo: "040_26_est_005_a" }),
    selo({ arquivo: "040_26_est_006_a" }),
  ]);
  assert.equal(c.codigo, "040-26");
});

test("código cai no fileName quando arquivo é nulo", () => {
  assert.equal(summarizeSelos([selo({ fileName: "113-22_arq.pdf" })]).codigo, "113-22");
});

test("revisão: letra final", () => {
  assert.equal(summarizeSelos([selo({ arquivo: "040_26_est_005_a" })]).revisao, "a");
});

test("revisão: letra antes da extensão", () => {
  assert.equal(summarizeSelos([selo({ fileName: "156_25_his_012_b.pdf" })]).revisao, "b");
});

test("sem marcador claro -> código/revisão null (não chuta)", () => {
  const c = summarizeSelos([selo({ fileName: "prancha-sem-padrao.pdf", obra: "Obra X" })]);
  assert.equal(c.codigo, null);
  assert.equal(c.revisao, null);
  assert.equal(c.obra, "Obra X");
});

test("ignora obra vazia/espaços", () => {
  const c = summarizeSelos([selo({ obra: "  " }), selo({ obra: "Real" }), selo({ obra: "" })]);
  assert.equal(c.obra, "Real");
});

console.log(`\n${passed} testes ok`);
