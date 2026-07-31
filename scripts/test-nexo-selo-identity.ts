/**
 * Smoke-test da CONFERÊNCIA DE IDENTIDADE DO SELO (a IA lê, a regra julga).
 *
 * Trava o acidente que originou o módulo: um volume emitido com o nome ou o
 * brasão de OUTRA prefeitura. Testa só a parte determinística — que é onde o
 * veredito nasce —, com as leituras que o modelo de visão devolveria.
 *
 *   node scripts/test-nexo-selo-identity.ts
 * (também exposto como `npm run test:nexo:selo-identity`)
 */
import assert from "node:assert/strict";

import {
  checkSeloIdentity,
  mesmoOrgao,
  type AlvoDaConferencia,
  type LeituraDoSelo,
} from "../server/nexo/selo-identity-core.ts";

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

const ALVO_CHAPECO = "Prefeitura Municipal de Chapecó";
const ENDERECO = "Rua Marechal Deodoro, 1230 - Centro";

/** Uma leitura limpa: tudo no lugar, tudo da prefeitura certa. */
function leitura(overrides: Partial<LeituraDoSelo> = {}): LeituraDoSelo {
  return {
    label: "040_26_his_001_a.pdf · p.1",
    endereco: ENDERECO,
    orgao: "PREFEITURA MUNICIPAL DE CHAPECO",
    logoPresente: true,
    logoOrgao: "PREFEITURA MUNICIPAL DE CHAPECO",
    numeracaoTexto: "01/11",
    folha: 1,
    total: 11,
    ...overrides,
  };
}

function alvo(leituras: LeituraDoSelo[]): AlvoDaConferencia {
  return {
    orgao: ALVO_CHAPECO,
    esperado: leituras.map((l) => ({ label: l.label, folha: l.folha, total: l.total })),
  };
}

test("selo limpo da prefeitura certa -> ok, sem achados", () => {
  const ls = [leitura(), leitura({ label: "b.pdf · p.1", folha: 2, numeracaoTexto: "02/11" })];
  const r = checkSeloIdentity(ls, alvo(ls));
  assert.equal(
    r.veredito,
    "ok",
    `achados: ${r.findings.map((f) => f.mensagem).join(" / ")}`,
  );
  assert.equal(r.findings.length, 0);
  assert.equal(r.amostras, 2);
});

test("acentuação e caixa não fazem diferença no nome do órgão", () => {
  assert.equal(mesmoOrgao("PREFEITURA MUNICIPAL DE CHAPECO", ALVO_CHAPECO), true);
  assert.equal(mesmoOrgao("prefeitura municipal de chapecó", ALVO_CHAPECO), true);
});

test("O ACIDENTE: selo de OUTRA prefeitura -> critico", () => {
  const ls = [leitura({ orgao: "PREFEITURA MUNICIPAL DE CRICIUMA" })];
  const r = checkSeloIdentity(ls, alvo(ls));
  assert.equal(r.veredito, "critico");
  const f = r.findings.find((x) => x.campo === "orgao");
  assert.ok(f, "esperava um achado de órgão");
  assert.equal(f.severidade, "critico");
});

test("O ACIDENTE: brasão de OUTRA prefeitura -> critico", () => {
  const ls = [leitura({ logoOrgao: "PREFEITURA MUNICIPAL DE FLORIANOPOLIS" })];
  const r = checkSeloIdentity(ls, alvo(ls));
  assert.equal(r.veredito, "critico");
  assert.ok(r.findings.some((f) => f.campo === "logo" && f.severidade === "critico"));
});

test("as palavras comuns não podem casar duas prefeituras diferentes", () => {
  // "Prefeitura Municipal de X" x "Prefeitura Municipal de Y": 3 palavras iguais.
  assert.equal(
    mesmoOrgao("Prefeitura Municipal de Criciúma", ALVO_CHAPECO),
    false,
    "o núcleo do nome é que decide, não as palavras que toda prefeitura tem",
  );
});

test("logo presente mas não atribuível -> aviso, NUNCA aprovado no escuro", () => {
  const ls = [leitura({ logoOrgao: "" })];
  const r = checkSeloIdentity(ls, alvo(ls));
  assert.equal(r.veredito, "aviso");
  const f = r.findings.find((x) => x.campo === "logo");
  assert.ok(f, "esperava um achado de logo");
  assert.match(f.mensagem, /confira à vista/i);
});

test("sem brasão nenhum -> aviso", () => {
  const ls = [leitura({ logoPresente: false, logoOrgao: "" })];
  const r = checkSeloIdentity(ls, alvo(ls));
  assert.equal(r.veredito, "aviso");
  assert.ok(r.findings.some((f) => f.campo === "logo" && /Sem brasão/i.test(f.mensagem)));
});

test("endereço ausente -> aviso", () => {
  const ls = [leitura({ endereco: "" })];
  const r = checkSeloIdentity(ls, alvo(ls));
  assert.equal(r.veredito, "aviso");
  assert.ok(r.findings.some((f) => f.campo === "endereco"));
});

test("endereço divergente entre folhas -> aviso (prancha intrusa)", () => {
  const ls = [
    leitura(),
    leitura({ label: "intrusa.pdf · p.1", endereco: "Avenida Getúlio Vargas, 55" }),
  ];
  const r = checkSeloIdentity(ls, alvo(ls));
  assert.equal(r.veredito, "aviso");
  const f = r.findings.find((x) => x.campo === "endereco" && /divergentes/i.test(x.mensagem));
  assert.ok(f, "esperava divergência de endereço");
});

test("numeração do carimbo diverge da folha esperada -> aviso", () => {
  const ls = [leitura({ folha: 7, numeracaoTexto: "07/11" })];
  const a: AlvoDaConferencia = {
    orgao: ALVO_CHAPECO,
    esperado: [{ label: ls[0].label, folha: 1, total: 11 }],
  };
  const r = checkSeloIdentity(ls, a);
  assert.equal(r.veredito, "aviso");
  const f = r.findings.find((x) => x.campo === "numeracao");
  assert.ok(f, "esperava um achado de numeração");
  assert.match(f.detalhe ?? "", /selo diz 7, esperado 1/);
});

test("total lido diferente pelas duas leituras -> info, não rebaixa o veredito", () => {
  // O caso real que apareceu ao vivo: o carimbo do SPDA diz 01/04, a leitura
  // de selo leu 4 e o modelo da conferência leu 5. É desacordo de OCR sobre a
  // MESMA página — não pode mandar revisar o volume.
  const ls = [leitura({ total: 5 })];
  const a: AlvoDaConferencia = {
    orgao: ALVO_CHAPECO,
    esperado: [{ label: ls[0].label, folha: 1, total: 4 }],
  };
  const r = checkSeloIdentity(ls, a);
  assert.equal(r.veredito, "ok", "desacordo de leitura não é defeito de documento");
  const f = r.findings.find((x) => x.campo === "numeracao");
  assert.ok(f, "esperava o registro da divergência");
  assert.equal(f.severidade, "info");
  assert.match(f.detalhe ?? "", /5 aqui, 4 na leitura do selo/);
});

test("amostra PARCIAL não pode acusar numeração (o carimbo fala da disciplina)", () => {
  // Uma folha anexada de um bloco de 11: o carimbo diz 01/11 e está certo.
  // A primeira versão comparava o 11 com "1 folha em mãos" e acusava todas.
  const ls = [leitura({ folha: 1, total: 11, numeracaoTexto: "01/11" })];
  const a: AlvoDaConferencia = {
    orgao: ALVO_CHAPECO,
    esperado: [{ label: ls[0].label, folha: 1, total: 11 }],
  };
  const r = checkSeloIdentity(ls, a);
  assert.equal(r.veredito, "ok");
  assert.equal(r.findings.length, 0, "amostra parcial é normal, não é achado");
});

test("campo de numeração ilegível -> aviso", () => {
  const ls = [leitura({ folha: null, total: null, numeracaoTexto: "" })];
  const r = checkSeloIdentity(ls, alvo(ls));
  assert.ok(r.findings.some((f) => f.campo === "numeracao" && /ilegível/i.test(f.mensagem)));
});

test("nenhuma amostra -> ok e zero achados (não inventa veredito)", () => {
  const r = checkSeloIdentity([], { orgao: ALVO_CHAPECO, esperado: [] });
  assert.equal(r.veredito, "ok");
  assert.equal(r.amostras, 0);
});

console.log(`\n${passed} teste(s) passaram.`);
