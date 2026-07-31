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

/* ----------------------------------------------- Volume de vários blocos ---- */

const ROTULOS = {
  his: "Hidrossanitario",
  inc: "Preventivo contra incendio",
  spd: "SPDA",
};

/** Um bloco inteiro: `quantas` folhas numeradas 1..N, todas presentes. */
function bloco(codigo: string, quantas: number): SeloFact[] {
  return Array.from({ length: quantas }, (_, i) =>
    fact({
      label: `040_26_${codigo}_${String(i + 1).padStart(3, "0")}_a.pdf`,
      sheet: i + 1,
      disciplinas: [codigo],
      bloco: codigo,
      totalLido: quantas,
      numeros: [quantas, i + 1],
    }),
  );
}

/** O volume 10 de 040-26, como está no disco: his 1-11, inc 1-5, spd 1-4. */
function volume10(): SeloFact[] {
  return [...bloco("his", 11), ...bloco("inc", 5), ...bloco("spd", 4)];
}

test("volume misto COMPLETO -> veredito ok (cada bloco numera 1..N)", () => {
  const r = checkSeloFacts(volume10(), { rotulos: ROTULOS });
  assert.equal(
    r.veredito,
    "ok",
    `volume perfeito não pode pedir revisão. Achados: ${r.findings
      .map((f) => `[${f.severidade}] ${f.mensagem}`)
      .join(" / ")}`,
  );
  assert.ok(
    !r.findings.some((f) => f.campo === "sequencia"),
    "não pode inventar folha faltando nem duplicada",
  );
});

test("volume misto anuncia a composição como FATO (info, não aviso)", () => {
  const r = checkSeloFacts(volume10(), { rotulos: ROTULOS });
  const f = r.findings.find((x) => x.campo === "disciplina");
  assert.ok(f, "esperava a composição do volume");
  assert.equal(f.severidade, "info", "volume misto é o caso comum, não um defeito");
  assert.match(f.mensagem, /3 disciplinas/);
  assert.match(f.detalhe ?? "", /Hidrossanitario: 11 folha/);
  assert.match(f.detalhe ?? "", /SPDA: 4 folha/);
});

test("folha faltando DENTRO de um bloco ainda é pega, e nomeia o bloco", () => {
  const facts = volume10().filter(
    (f) => !(f.bloco === "inc" && f.sheet === 3), // some a inc 003
  );
  const r = checkSeloFacts(facts, { rotulos: ROTULOS });
  assert.equal(r.veredito, "aviso");
  const seq = r.findings.filter((x) => x.campo === "sequencia");
  assert.equal(seq.length, 1, "só o bloco de incêndio pode acusar falta");
  assert.match(seq[0].mensagem, /^Preventivo contra incendio: /);
  assert.match(seq[0].mensagem, /\b3\b/);
});

test("mesma folha duas vezes NO MESMO bloco -> aviso; em blocos diferentes, não", () => {
  // his 1 e inc 1 coexistem sem defeito: cada disciplina numera do 1.
  assert.equal(checkSeloFacts(volume10(), { rotulos: ROTULOS }).veredito, "ok");

  const comDuplicata = [...volume10(), ...bloco("spd", 1)]; // spd 001 repetida
  const r = checkSeloFacts(comDuplicata, { rotulos: ROTULOS });
  assert.ok(
    r.findings.some(
      (x) => x.campo === "sequencia" && /duplicad/i.test(x.mensagem) && /^SPDA: /.test(x.mensagem),
    ),
    "esperava duplicata no bloco do SPDA",
  );
});

test("revisão diverge ENTRE blocos sem acusar; DENTRO do bloco acusa", () => {
  const entre = [...bloco("his", 3), ...bloco("inc", 2).map((f) => ({ ...f, revisao: "b" }))];
  assert.ok(
    !checkSeloFacts(entre, { rotulos: ROTULOS }).findings.some((f) => f.campo === "revisao"),
    "cada disciplina tem o seu ciclo de revisão",
  );

  const dentro = bloco("his", 3);
  dentro[2] = { ...dentro[2], revisao: "b" };
  const r = checkSeloFacts(dentro, { rotulos: ROTULOS });
  assert.ok(
    r.findings.some((f) => f.campo === "revisao" && f.severidade === "aviso"),
    "revisão misturada dentro da mesma disciplina é aviso",
  );
});

test("prancha de OUTRO projeto continua crítica, mesmo em volume misto", () => {
  const facts = volume10();
  facts.push(
    fact({ label: "125-23_top_001_A1.pdf", sheet: 1, codigo: "125-23", bloco: "top" }),
  );
  const r = checkSeloFacts(facts, { rotulos: ROTULOS });
  assert.equal(r.veredito, "critico");
  assert.ok(r.findings.some((f) => f.campo === "codigo" && f.severidade === "critico"));
});

test("sem bloco calculado, o comportamento antigo continua (disciplina = aviso)", () => {
  const facts = [
    fact({ sheet: 1, disciplinas: ["his"] }),
    fact({ sheet: 2, disciplinas: ["inc"] }),
    fact({ sheet: 3, disciplinas: ["his"] }),
  ];
  const r = checkSeloFacts(facts);
  assert.ok(
    r.findings.some((f) => f.campo === "disciplina" && f.severidade === "aviso"),
    "sem bloco, o nome do arquivo é a única pista de mistura",
  );
});

console.log(`\n${passed} teste(s) passaram.`);
