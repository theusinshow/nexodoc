/**
 * A LINHA DO TEMPO do achado — fala e evento na mesma cronologia. Puro → node cru.
 *
 *   node scripts/test-conversa-do-achado.ts   (== npm run test:conversa-achado)
 */
import assert from "node:assert/strict";

import { linhaDoTempo, type LinhaCrua } from "../lib/conversa-do-achado.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

function crua(over: Partial<LinhaCrua> = {}): LinhaCrua {
  return {
    kind: "comentario",
    authorEmail: "victor@prosul.com",
    authorNome: "Victor",
    body: "",
    details: null,
    createdAt: 1_000,
    ...over,
  };
}

console.log("conversa do achado\n");

test("a fala de alguém sai como fala, não como evento", () => {
  const [linha] = linhaDoTempo([crua({ body: "isso é do estrutural, não meu" })]);
  assert.equal(linha.ehEvento, false);
  assert.equal(linha.quem, "Victor");
  assert.equal(linha.body, "isso é do estrutural, não meu");
  assert.equal(linha.frase, "");
});

test("a atribuição vira frase, e o recado continua sendo fala", () => {
  /*
   * O recado do encaminhamento NÃO é uma segunda funcionalidade: é a primeira
   * mensagem da conversa. A linha carrega as duas coisas — o que aconteceu e o
   * que a pessoa escreveu junto.
   */
  const [linha] = linhaDoTempo([
    crua({
      kind: "atribuiu",
      body: "olha o item 14",
      details: { para: "milton@prosul.com", paraNome: "Milton" },
    }),
  ]);
  assert.equal(linha.ehEvento, true);
  assert.equal(linha.frase, "atribuiu a Milton");
  assert.equal(linha.body, "olha o item 14", "o recado sobrevive ao evento");
});

test("a reatribuição diz DE QUEM saiu — é o que o histórico existe para guardar", () => {
  /*
   * Antes deste trabalho, reatribuir sobrescrevia `assigneeEmail` e quem tinha o
   * achado desaparecia sem rastro.
   */
  const [linha] = linhaDoTempo([
    crua({
      kind: "reatribuiu",
      details: { deNome: "Milton", paraNome: "Carla" },
    }),
  ]);
  assert.equal(linha.frase, "passou de Milton para Carla");
});

test("envolver e desenvolver são eventos distintos", () => {
  const linhas = linhaDoTempo([
    crua({ kind: "envolveu", details: { paraNome: "Carla" }, createdAt: 1 }),
    crua({ kind: "desenvolveu", details: { paraNome: "Carla" }, createdAt: 2 }),
  ]);
  assert.equal(linhas[0].frase, "envolveu Carla");
  assert.equal(linhas[1].frase, "tirou Carla dos envolvidos");
});

test("o fecho diz COMO foi encerrado, e não só que foi", () => {
  const casos: [string, string][] = [
    ["FIXED_IN_DOC", "marcou como corrigido no documento"],
    ["FALSE_POSITIVE", "marcou como falso positivo"],
    ["ACCEPTED_RISK", "assumiu o risco"],
  ];
  for (const [desfecho, esperado] of casos) {
    const [linha] = linhaDoTempo([crua({ kind: "resolveu", details: { desfecho } })]);
    assert.equal(linha.frase, esperado, desfecho);
  }
});

test("reabrir é evento próprio", () => {
  const [linha] = linhaDoTempo([crua({ kind: "reabriu" })]);
  assert.equal(linha.frase, "reabriu o achado");
});

test("a ordem é cronológica, e não a de chegada do banco", () => {
  const linhas = linhaDoTempo([
    crua({ body: "terceiro", createdAt: 300 }),
    crua({ body: "primeiro", createdAt: 100 }),
    crua({ body: "segundo", createdAt: 200 }),
  ]);
  assert.deepEqual(
    linhas.map((l) => l.body),
    ["primeiro", "segundo", "terceiro"],
  );
});

test("kind desconhecido não some e não quebra", () => {
  /*
   * `kind` é texto, não enum — o vocabulário cresce sem migração. Uma linha de
   * um `kind` que este código não conhece tem que aparecer mesmo assim: sumir
   * com um pedaço do histórico é pior do que mostrá-lo sem frase bonita.
   */
  const [linha] = linhaDoTempo([crua({ kind: "inventou", body: "olá" })]);
  assert.equal(linha.ehEvento, true);
  assert.equal(linha.frase, "registrou uma mudança");
  assert.equal(linha.body, "olá");
});

test("sem nome, o e-mail serve — melhor endereço do que linha sem dono", () => {
  const [linha] = linhaDoTempo([crua({ authorNome: "", body: "oi" })]);
  assert.equal(linha.quem, "victor@prosul.com");
});

console.log(`\n${passed} passaram`);
