/**
 * A REGRA DO EXPURGO — alcance, confirmação e os bytes órfãos. Puro → node cru.
 *
 *   node scripts/test-expurgo.ts   (== npm run test:expurgo)
 */
import assert from "node:assert/strict";

import {
  auditoriasDasConversas,
  chaveDaObra,
  checksumsOrfaos,
  confirmacaoConfere,
  conversasDoAlcance,
  palavraDeConfirmacao,
  SEM_OBRA,
  type ConversaParaExpurgo,
} from "../lib/expurgo.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

const c = (
  id: string,
  projectId: string | null = null,
  folderKey: string | null = null,
): ConversaParaExpurgo => ({ id, projectId, folderKey });

console.log("expurgo\n");

/* ────────────────────────────── a obra ────────────────────────────── */

test("a identidade vence o cache de exibição", () => {
  /*
   * `folderKey` é derivado no navegador e `projectId` é a identidade. Se o
   * cache mandasse, duas conversas do mesmo projeto cairiam em obras
   * diferentes — e o expurgo por obra apagaria metade em silêncio.
   */
  assert.equal(chaveDaObra(c("1", "proj-a", "088-25-CRICIUMA")), "proj-a");
});

test("sem identidade, o cache ainda endereça a conversa antiga", () => {
  assert.equal(chaveDaObra(c("1", null, "088-25-CRICIUMA")), "088-25-CRICIUMA");
});

test("sem os dois, cai em SEM_OBRA — que é fato, não sujeira", () => {
  assert.equal(chaveDaObra(c("1", null, null)), SEM_OBRA);
  assert.equal(chaveDaObra(c("1", "   ", "  ")), SEM_OBRA);
});

/* ──────────────────────────── o alcance ───────────────────────────── */

test("obra alcança as duas conversas dela, e nenhuma da vizinha", () => {
  const conversas = [
    c("1", "proj-a"),
    c("2", "proj-a"),
    c("3", "proj-b"),
  ];
  assert.deepEqual(conversasDoAlcance(conversas, { tipo: "obra", chave: "proj-a" }), ["1", "2"]);
});

test("obra alcança conversa antiga e nova do mesmo projeto", () => {
  /*
   * O caso que o `chaveDaObra` existe para cobrir: uma migrada (tem
   * `projectId`) e uma anterior (só `folderKey`). Elas SÓ caem na mesma obra se
   * a antiga tiver sido endereçada — se não tiver, ficam separadas, e isso é
   * honesto: o servidor não sabe que são a mesma.
   */
  const conversas = [c("nova", "088-25-CRICIUMA"), c("velha", null, "088-25-CRICIUMA")];
  assert.deepEqual(
    conversasDoAlcance(conversas, { tipo: "obra", chave: "088-25-CRICIUMA" }),
    ["nova", "velha"],
  );
});

test("SEM_OBRA é um alcance como qualquer outro", () => {
  const conversas = [c("1", "proj-a"), c("2"), c("3")];
  assert.deepEqual(conversasDoAlcance(conversas, { tipo: "obra", chave: SEM_OBRA }), ["2", "3"]);
});

test("tudo é tudo", () => {
  const conversas = [c("1", "proj-a"), c("2"), c("3", null, "x")];
  assert.deepEqual(conversasDoAlcance(conversas, { tipo: "tudo" }), ["1", "2", "3"]);
});

test("seleção filtra pelo que EXISTE — id desconhecido não vira lápide", () => {
  /*
   * Uma lápide para id que o servidor não conhece mandaria as máquinas apagarem
   * trabalho que o expurgo nunca viu e nunca contou na prévia.
   */
  const conversas = [c("1"), c("2")];
  assert.deepEqual(
    conversasDoAlcance(conversas, { tipo: "selecao", ids: ["2", "fantasma"] }),
    ["2"],
  );
});

test("seleção vazia não alcança nada", () => {
  assert.deepEqual(conversasDoAlcance([c("1")], { tipo: "selecao", ids: [] }), []);
});

/* ───────────────────── as auditorias da conversa ──────────────────── */

test("colhe os auditId de dentro do JSON, sem repetir", () => {
  const ids = auditoriasDasConversas([
    { auditorias: [{ auditId: "a1", artifactId: "x" }, { auditId: "a2", artifactId: "y" }] },
    { auditorias: [{ auditId: "a2", artifactId: "z" }] },
  ]);
  assert.deepEqual(ids.sort(), ["a1", "a2"]);
});

test("tolera conversa sem auditoria, nula, e com formato inesperado", () => {
  /*
   * O registro é schemaless e ganha campo toda semana. Estourar aqui deixaria o
   * banco pela metade, no meio de um expurgo.
   */
  assert.deepEqual(
    auditoriasDasConversas([null, {}, { auditorias: "nao é lista" }, { auditorias: [{}, { auditId: 7 }] }]),
    [],
  );
});

/* ────────────────────────── a confirmação ─────────────────────────── */

test("a palavra é o NOME DO ALVO, não uma palavra genérica", () => {
  assert.equal(palavraDeConfirmacao({ tipo: "tudo" }), "ZERAR TUDO");
  assert.equal(
    palavraDeConfirmacao({ tipo: "obra", chave: "proj-a" }, "088-25 CRICIÚMA"),
    "088-25 CRICIÚMA",
  );
});

test("obra sem rótulo cai na chave — nunca numa palavra vazia", () => {
  /*
   * Palavra vazia liberaria o botão com o campo em branco, que é o oposto do
   * que ele existe para fazer.
   */
  assert.equal(palavraDeConfirmacao({ tipo: "obra", chave: "proj-a" }, "   "), "proj-a");
});

test("acento, caixa e espaço repetido não reprovam a digitação certa", () => {
  assert.ok(confirmacaoConfere("088-25 criciuma", "088-25 CRICIÚMA"));
  assert.ok(confirmacaoConfere("  088-25   CRICIÚMA ", "088-25 CRICIÚMA"));
  assert.ok(confirmacaoConfere("zerar tudo", "ZERAR TUDO"));
});

test("a palavra do alvo errado NÃO confirma", () => {
  assert.equal(confirmacaoConfere("088-25 CRICIUMA", "117-25 CRICIUMA"), false);
  assert.equal(confirmacaoConfere("CONFIRMAR", "ZERAR TUDO"), false);
});

test("campo vazio nunca confirma, nem contra esperado vazio", () => {
  assert.equal(confirmacaoConfere("", "ZERAR TUDO"), false);
  assert.equal(confirmacaoConfere("", ""), false);
  assert.equal(confirmacaoConfere("   ", "  "), false);
});

/* ─────────────────────── os bytes compartilhados ──────────────────── */

test("o checksum que outra obra ainda usa NÃO morre", () => {
  /*
   * `StoredFile` é endereçado pelo conteúdo: o mesmo memorial em duas obras é
   * uma linha só. Este é o teste que impede o expurgo de uma obra apagar o
   * memorial da outra.
   */
  assert.deepEqual(checksumsOrfaos(["aaa", "bbb"], ["bbb"]), ["aaa"]);
});

test("nada sobra referenciado, tudo é recolhido", () => {
  assert.deepEqual(checksumsOrfaos(["aaa", "bbb"], []), ["aaa", "bbb"]);
});

test("candidato repetido conta uma vez, e vazio não entra", () => {
  assert.deepEqual(checksumsOrfaos(["aaa", "aaa", ""], []), ["aaa"]);
});

console.log(`\n${passed} passaram`);
