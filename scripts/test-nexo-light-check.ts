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
import { totalDeReferencia } from "../server/nexo/reconcile-sheets.ts";

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

/* ------------------------------------ Total de referência corrigido à mão ---- */

/** O conjunto completo, mas com o carimbo lido a MAIS ("de 21" em vez de 11). */
function totalLidoAMais(): SeloFact[] {
  return [1, 2, 3].map((n) =>
    fact({ sheet: n, totalLido: 21, numeros: [21, n] }),
  );
}

test("carimbo com total lido a mais acusa folhas faltando num conjunto completo", () => {
  // O defeito que a correção existe para consertar. Este teste trava o
  // comportamento ANTIGO de propósito: sem ele não dá para provar que a correção
  // muda alguma coisa.
  const r = checkSeloFacts(totalLidoAMais());
  const seq = r.findings.find((x) => x.campo === "sequencia");
  assert.ok(seq, "esperava o aviso de sequência");
  assert.match(seq.mensagem, /1\.\.21/);
  assert.equal(r.veredito, "aviso");
});

test("o total corrigido à mão apaga as folhas faltando inventadas", () => {
  const r = checkSeloFacts(totalLidoAMais(), { totais: { "": 3 } });
  assert.equal(
    r.findings.some((x) => x.campo === "sequencia"),
    false,
    "com o total certo, não faltam folhas",
  );
  assert.equal(r.veredito, "ok");
});

test("com total corrigido, a divergência do carimbo é explicada — não chamada de ruído", () => {
  const r = checkSeloFacts(totalLidoAMais(), { totais: { "": 3 } });
  const total = r.findings.find((x) => x.campo === "total");
  assert.ok(total, "esperava o achado info de total");
  assert.equal(total.severidade, "info");
  assert.match(total.mensagem, /corrigido à mão/);
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

test("a conferência e a LD aplicam a MESMA precedência de total", () => {
  /*
   * As duas calculam o total de referência separadamente: a LD por
   * `totalDeReferencia` (em `reconcile-sheets`), a conferência inline no núcleo
   * puro — que não pode importar aquele módulo, porque o `tsc` recusa a extensão
   * `.ts` num import de valor e sem ela o node cru não acha o arquivo.
   *
   * Este teste é a corda entre as duas. Se uma mudar sozinha, ele quebra — e o
   * estrago que ele evita é a LD numerar "05/11" enquanto a conferência cobra 21
   * folhas do mesmo conjunto.
   */
  const casos: [number, number | null | undefined, number][] = [
    [11, undefined, 11], // sem correção, vale a inferência
    [21, 11, 11], // correção vence
    [40, 2, 2], // vence inclusive para MENOS
    [11, 0, 11], // zero é limpar o campo
    [11, -5, 11],
  ];
  for (const [inferido, manual, esperado] of casos) {
    assert.equal(totalDeReferencia(inferido, manual), esperado, `LD: ${inferido}/${manual}`);

    // A conferência não expõe o número; ela o mostra na mensagem de sequência.
    // Um bloco com UMA folha (nº 1) e o total inferido forçado pelo carimbo.
    const facts = [fact({ sheet: 1, totalLido: inferido, numeros: [inferido, 1] })];
    const r = checkSeloFacts(facts, manual == null ? {} : { totais: { "": manual } });
    const seq = r.findings.find((x) => x.campo === "sequencia");
    const cobrado = seq ? Number(/1\.\.(\d+)/.exec(seq.mensagem)?.[1]) : 1;
    assert.equal(cobrado, esperado, `conferência: ${inferido}/${manual}`);
  }
});

test("o total corrigido é POR BLOCO — corrigir um não mexe no outro", () => {
  // his com o carimbo lido a mais; inc correto. Corrigir his não pode fazer inc
  // passar a cobrar folhas que ele não tem.
  const facts = [
    ...bloco("his", 3).map((f) => ({ ...f, totalLido: 21, numeros: [21, f.sheet as number] })),
    ...bloco("inc", 2),
  ];
  const r = checkSeloFacts(facts, { totais: { his: 3 }, rotulos: ROTULOS });
  assert.equal(
    r.findings.some((x) => x.campo === "sequencia"),
    false,
    `não deveria faltar folha: ${r.findings.map((f) => f.mensagem).join(" | ")}`,
  );
});

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

/* ---------------------------------------------------------------------------
 * AS FOLHAS ENVOLVIDAS — acrescentadas em 28/08/2026 para o canvas poder marcar
 * o nó. A mensagem sempre foi agregada; sem esta lista dava para pintar a coluna
 * inteira e não dava para dizer QUAL prancha.
 * ------------------------------------------------------------------------- */

test("codigo divergente aponta TODAS as pranchas envolvidas, e nao so a minoria", () => {
  const facts = [
    fact({ sheet: 1 }),
    fact({ sheet: 2 }),
    fact({ sheet: 3, codigo: "999-99", label: "999_99_his_003_a.pdf" }),
  ];
  const achado = checkSeloFacts(facts).findings.find((f) => f.campo === "codigo");
  assert.ok(achado, "o achado de código existe");
  assert.equal(achado!.folhas?.length, 3);
  assert.ok(achado!.folhas?.includes("999_99_his_003_a.pdf"));
  // A maioria também entra: ninguém sabe qual grupo é o intruso, e eleger a
  // minoria como culpada seria palpite com cara de fato.
  assert.ok(achado!.folhas?.includes("040_26_his_001_a.pdf"));
});

test("revisao divergente aponta as pranchas das duas revisoes", () => {
  const facts = [fact({ sheet: 1 }), fact({ sheet: 2, revisao: "b" }), fact({ sheet: 3 })];
  const achado = checkSeloFacts(facts).findings.find((f) => f.campo === "revisao");
  assert.ok(achado);
  assert.equal(achado!.folhas?.length, 3);
});

test("numero duplicado aponta SO as pranchas que repetem", () => {
  const facts = [
    fact({ sheet: 1 }),
    fact({ sheet: 2, label: "040_26_his_002_a.pdf" }),
    fact({ sheet: 2, label: "040_26_his_002_b.pdf" }),
  ];
  const achado = checkSeloFacts(facts).findings.find(
    (f) => f.campo === "sequencia" && /duplicado/i.test(f.mensagem),
  );
  assert.ok(achado);
  assert.deepEqual(achado!.folhas, ["040_26_his_002_a.pdf", "040_26_his_002_b.pdf"]);
});

test("FOLHA FALTANDO nao aponta no nenhum — ela nao esta no conjunto", () => {
  const facts = [fact({ sheet: 1 }), fact({ sheet: 3 })];
  const achado = checkSeloFacts(facts).findings.find(
    (f) => f.campo === "sequencia" && /faltando/i.test(f.mensagem),
  );
  assert.ok(achado, "o achado de falta existe");
  assert.equal(achado!.folhas, undefined, "marcar um vizinho seria acusar o inocente");
});

test("conjunto limpo continua sem achado nenhum — o campo novo nao inventa aviso", () => {
  const r = checkSeloFacts(conjuntoLimpo());
  assert.equal(r.veredito, "ok");
  assert.equal(r.findings.length, 0);
});


console.log(`\n${passed} teste(s) passaram.`);
