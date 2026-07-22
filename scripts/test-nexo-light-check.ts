/**
 * Smoke-test da CONFERÊNCIA LEVE do Nexo (porta de qualidade determinística,
 * sem IA). Trava a classe de erro que motivou o projeto: prancha de OUTRO
 * projeto (código/obra divergente) e folha faltando/duplicada.
 *
 * Roda sem framework, direto no Node com type-stripping nativo:
 *   node scripts/test-nexo-light-check.ts
 * (também exposto como `npm run test:nexo:check`)
 *
 * Testa a checagem PURA `checkSeloFacts` (sobre fatos já parseados), que não
 * depende do parser de nome — por isso roda com node cru. O parsing do nome
 * (código/folha do arquivo) é da responsabilidade de parse-filename e tem
 * cobertura própria.
 */
import assert from "node:assert/strict";

import { checkSeloFacts, type SeloFact } from "../server/nexo/light-check-core.ts";

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

const OBRA = "Escola Municipal Primeira Linha";

/** Fato de uma prancha limpa (himdro, projeto 040-26, rev a). */
function fact(overrides: Partial<SeloFact> & { sheet: number }): SeloFact {
  return {
    label: `040_26_his_${String(overrides.sheet).padStart(3, "0")}_a.pdf`,
    codigo: "040-26",
    obra: OBRA,
    revisao: "a",
    disciplinas: ["his"],
    totalLido: 3,
    numeros: [3, overrides.sheet],
    ...overrides,
  };
}

function conjuntoLimpo(): SeloFact[] {
  return [fact({ sheet: 1 }), fact({ sheet: 2 }), fact({ sheet: 3 })];
}

test("conjunto consistente -> veredito ok, sem findings", () => {
  const r = checkSeloFacts(conjuntoLimpo());
  assert.equal(r.veredito, "ok");
  assert.equal(r.findings.length, 0, "não deveria haver achados num conjunto limpo");
});

test("código divergente (prancha de outro projeto) -> critico", () => {
  const facts = conjuntoLimpo();
  facts.push(fact({ sheet: 4, codigo: "113-22", totalLido: 4, numeros: [4, 4] }));
  const r = checkSeloFacts(facts);
  assert.equal(r.veredito, "critico");
  const f = r.findings.find((x) => x.campo === "codigo");
  assert.ok(f, "esperava um achado de código");
  assert.equal(f.severidade, "critico");
});

test("folha faltando na sequência -> aviso", () => {
  const facts = [
    fact({ sheet: 1, totalLido: 4, numeros: [4, 1] }),
    fact({ sheet: 2, totalLido: 4, numeros: [4, 2] }),
    fact({ sheet: 4, totalLido: 4, numeros: [4, 4] }), // folha 3 ausente
  ];
  const r = checkSeloFacts(facts);
  assert.equal(r.veredito, "aviso");
  const f = r.findings.find((x) => x.campo === "sequencia");
  assert.ok(f, "esperava um achado de sequência");
  assert.match(f.mensagem, /\b3\b/, "a mensagem deve citar a folha 3 faltante");
});

test("folha duplicada -> aviso", () => {
  const facts = [fact({ sheet: 1 }), fact({ sheet: 2 }), fact({ sheet: 2 })];
  const r = checkSeloFacts(facts);
  assert.equal(r.veredito, "aviso");
  assert.ok(
    r.findings.some((x) => x.campo === "sequencia" && /duplicad/i.test(x.mensagem)),
    "esperava um achado de duplicata",
  );
});

test("obra divergente entre selos -> critico", () => {
  const facts = conjuntoLimpo();
  facts[2] = fact({ sheet: 3, obra: "Creche Outro Bairro" });
  const r = checkSeloFacts(facts);
  assert.equal(r.veredito, "critico");
  const f = r.findings.find((x) => x.campo === "obra");
  assert.ok(f, "esperava um achado de obra");
  assert.equal(f.severidade, "critico");
});

test("total do selo divergente (OCR) sozinho -> info, veredito ok", () => {
  const facts = [
    fact({ sheet: 1 }),
    fact({ sheet: 2 }),
    fact({ sheet: 3, totalLido: 2, numeros: [2, 3] }), // total lido "errado"
  ];
  const r = checkSeloFacts(facts);
  assert.equal(r.veredito, "ok", "info não deve rebaixar o veredito");
  assert.ok(
    r.findings.some((x) => x.campo === "total" && x.severidade === "info"),
    "esperava um achado info de total",
  );
});

console.log(`\n${passed} teste(s) passaram.`);
