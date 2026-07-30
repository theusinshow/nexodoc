/**
 * Trava o extrator da caracterização da obra com as frases REAIS dos memoriais
 * do escritório.
 *
 *   node scripts/test-caracterizacao.ts   (== npm run test:caracterizacao)
 *
 * As frases vêm dos cinco memoriais de `docs/samples` e `tests/` — que são
 * confidenciais e não versionados. Os trechos aqui são só a caracterização da
 * obra (endereço público de obra pública), o mínimo para o teste ter valor sem
 * carregar projeto de cliente para dentro do repositório.
 *
 * São DOIS modelos de memorial diferentes, e é por isso que o extrator precisa
 * de mais de um padrão: um escreve "Obra: X localizado na …, no município de
 * Y", o outro escreve "…, a ser executada em lote …, Cidade-UF".
 */
import assert from "node:assert/strict";

import { lerCaracterizacaoDaObra } from "../lib/caracterizacao-obra.ts";

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

/** Envolve o trecho no contexto de seção, como vem do PDF. */
function comoNoPdf(corpo: string): string {
  return `1 – APRESENTAÇÃO 1 APRESENTAÇÃO 1.1 Caracterização da obra ${corpo} 1.2 Quadro de Áreas 1.3 Plantas e desenhos`;
}

test("040-26 · Chapecó — 'localizado na … no município de X, Estado'", () => {
  const c = lerCaracterizacaoDaObra(
    comoNoPdf(
      "Obra: Revitalização da Feira Municipal de Chapecó localizado na Travessa Brasil, snº, bairro Centro, no município de Chapecó, Santa Catarina. A proposta possui um total 1.295,37 m² área construída.",
    ),
  );
  assert.equal(c.endereco, "Travessa Brasil, snº, bairro Centro, no município de Chapecó, Santa Catarina");
  assert.equal(c.bairro, "Centro");
  assert.equal(c.municipio, "Chapecó");
  assert.equal(c.areaConstruida, "1.295,37 m²");
});

test("156-25 · Criciúma — outro modelo, sem a palavra 'Obra:'", () => {
  const c = lerCaracterizacaoDaObra(
    comoNoPdf(
      "O presente Memorial Descritivo refere-se à implantação da nova sede da Defesa Civil, a ser executada em lote da prefeitura, localizado no Morro do Céu, ao final da Rua Almirante Saldanha da Gama S/N, Comerciário, Criciúma-SC. O terreno é constituído por grande lote com área total de 64.127,85 m².",
    ),
  );
  assert.match(c.endereco, /Morro do Céu/);
  assert.equal(c.municipio, "Criciúma");
  assert.equal(c.uf, "SC");
  assert.equal(c.areaTerreno, "64.127,85 m²");
});

test("113-22 · Navegantes — 'localizada na …, em Cidade-UF'", () => {
  const c = lerCaracterizacaoDaObra(
    comoNoPdf(
      "Obra: Hospital Municipal Nossa Senhora dos Navegantes, localizada na Rua Natividade Costa, n° 641, bairro São Domingos, em Navegantes-SC.",
    ),
  );
  assert.equal(c.bairro, "São Domingos");
  assert.equal(c.municipio, "Navegantes");
  assert.equal(c.uf, "SC");
});

test("117-25 · Criciúma — 'em Cidade, UF' com vírgula", () => {
  const c = lerCaracterizacaoDaObra(
    comoNoPdf(
      "Obra: Unidade Básica de Saúde localizada na Rua São Francisco de Assis, S/N - Bairro Vila Manaus, em Criciúma, SC. Tipo de Intervenção: Construção.",
    ),
  );
  assert.equal(c.bairro, "Vila Manaus");
  // O bug que o corpus real pegou: a captura engolia " em Santa Catarina" e
  // devolvia a frase inteira como nome de cidade.
  assert.equal(c.municipio, "Criciúma");
  assert.equal(c.uf, "SC");
});

test("duas UBS do mesmo programa se distinguem PELO ENDEREÇO", () => {
  // É o caso que justifica o extrator: o nome da obra é idêntico.
  const a = lerCaracterizacaoDaObra(
    comoNoPdf("Obra: Unidade Básica de Saúde localizada na Rua Pedro Antônio, S/N - Bairro São João, em Criciúma, SC."),
  );
  const b = lerCaracterizacaoDaObra(
    comoNoPdf("Obra: Unidade Básica de Saúde localizada na Rua São Francisco de Assis, S/N - Bairro Vila Manaus, em Criciúma, SC."),
  );
  assert.notEqual(a.endereco, b.endereco);
  assert.notEqual(a.bairro, b.bairro);
});

test("o SUMÁRIO não é confundido com a seção", () => {
  // No sumário a expressão aparece seguida da linha pontilhada e do número da
  // página; pegar ali devolveria um trecho vazio de conteúdo.
  const c = lerCaracterizacaoDaObra(
    "Sumário 1 APRESENTAÇÃO ......... 12 1.1 Caracterização da obra ......... 12 1.2 Quadro de Áreas ......... 13",
  );
  assert.equal(c.endereco, "");
  assert.equal(c.trecho, "");
});

test("sem a seção, devolve tudo vazio — nunca chuta", () => {
  const c = lerCaracterizacaoDaObra("Documento qualquer, sem caracterização de obra nenhuma.");
  assert.equal(c.endereco, "");
  assert.equal(c.municipio, "");
  assert.equal(c.trecho, "");
});

console.log(`\n${passed} teste(s) passaram.`);
