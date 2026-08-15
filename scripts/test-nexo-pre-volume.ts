/**
 * Smoke-test da PRÉ-CONDIÇÃO da montagem do volume.
 *
 * O defeito que originou este teste: numa conversa retomada (F5 / histórico) os
 * bytes das pranchas não voltam, e o botão "Montar os N volumes" montava assim
 * mesmo — o PDF saía com capa, separatriz e LD e nenhuma prancha, sem um aviso.
 * A trava existia só no `disabled` do botão do card, que o caminho em lote não
 * atravessa.
 *
 * Roda sem framework, direto no Node com type-stripping nativo:
 *   node scripts/test-nexo-pre-volume.ts
 * (também exposto como `npm run test:nexo:pre-volume`)
 */
import assert from "node:assert/strict";

import {
  motivoParaNaoMontar,
  type PartesDoVolume,
} from "../modules/nexo/lib/pre-condicoes-do-volume.ts";

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

/** Um tomo pronto para montar: tudo em mãos, uma disciplina só. */
function pronto(extra: Partial<PartesDoVolume> = {}): PartesDoVolume {
  return { temCapa: true, temLd: true, misto: false, pranchas: 12, ...extra };
}

test("tudo em mãos -> monta", () => {
  assert.equal(motivoParaNaoMontar(pronto()), null);
});

test("SEM PRANCHAS -> não monta (o defeito da conversa retomada)", () => {
  const motivo = motivoParaNaoMontar(pronto({ pranchas: 0 }));
  assert.notEqual(
    motivo,
    null,
    "volume sem prancha sairia com capa+separatriz+LD e nada dentro",
  );
  assert.match(String(motivo), /prancha/i);
});

test("sem pranchas vence as outras faltas — é a que some em silêncio", () => {
  assert.match(
    String(motivoParaNaoMontar({ temCapa: false, temLd: false, misto: false, pranchas: 0 })),
    /prancha/i,
  );
});

test("sem capa -> não monta", () => {
  assert.match(String(motivoParaNaoMontar(pronto({ temCapa: false }))), /capa/i);
});

test("uma disciplina sem LD -> não monta", () => {
  assert.match(String(motivoParaNaoMontar(pronto({ temLd: false }))), /LD/);
});

test("MISTO sem LD -> monta (a LD de cada bloco é gerada na montagem)", () => {
  assert.equal(motivoParaNaoMontar(pronto({ temLd: false, misto: true })), null);
});

test("misto sem pranchas continua travado", () => {
  assert.match(
    String(motivoParaNaoMontar(pronto({ misto: true, temLd: false, pranchas: 0 }))),
    /prancha/i,
  );
});

/*
 * A DISCIPLINA QUE NÃO TEM LD — e por que ela precisa chegar até aqui.
 *
 * O plano de geração deixou de oferecer LD para sondagem (`blocoGera`). Se esta
 * pré-condição não soubesse disso, o volume só de sondagem ficaria TRAVADO PARA
 * SEMPRE: o plano não oferece a LD, e o botão continua pedindo uma. As duas
 * regras têm de ler a mesma tabela — este teste é o que impede que elas se
 * separem de novo.
 */
test("volume só de sondagem monta SEM LD — o escritório não entrega LD de sondagem", () => {
  assert.equal(motivoParaNaoMontar(pronto({ temLd: false, codigo: "snd" })), null);
});

test("mas um volume de arquitetônico sem LD continua travado", () => {
  assert.match(String(motivoParaNaoMontar(pronto({ temLd: false, codigo: "arq" }))), /LD/);
});

/*
 * SEM CÓDIGO, NADA MUDA. O código do volume é opcional — nem todo caminho que
 * chama isto sabe a disciplina —, e a ausência não pode virar dispensa de LD.
 */
test("sem código declarado, a LD continua sendo exigida", () => {
  assert.match(String(motivoParaNaoMontar(pronto({ temLd: false }))), /LD/);
});

test("a falta da capa vence a dispensa da LD", () => {
  assert.match(
    String(motivoParaNaoMontar(pronto({ temCapa: false, temLd: false, codigo: "snd" }))),
    /capa/i,
  );
});

console.log(`\n${passed} teste(s) passaram.`);
