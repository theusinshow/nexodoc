/**
 * O AGRUPAMENTO da barra lateral — a PASTA manda, o tipo é etiqueta.
 *
 *   node scripts/test-group-conversations.ts  (== npm run test:nexo:grupos)
 */
import assert from "node:assert/strict";

import { groupConversations } from "../modules/nexo/lib/group-conversations.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("agrupamento da barra\n");

const conversa = (
  id: string,
  title: string,
  folderKey: string | undefined,
  tipo: "volume" | "auditoria",
) =>
  ({
    id,
    title,
    tipo,
    updatedAt: 1,
    createdAt: 1,
    ...(folderKey ? { folderKey } : {}),
  }) as never;

const LISTA = [
  conversa("1", "MET · HIS", "084-25-CRICIUMA", "volume"),
  conversa("2", "Memorial", "084-25-CRICIUMA", "auditoria"),
  conversa("3", "EST", "040-26-CHAPECO", "volume"),
  conversa("4", "Conversa nova", undefined, "volume"),
];

test("volume e auditoria do mesmo projeto caem na MESMA pasta", () => {
  /*
   * A v2 desenhava DUAS SEÇÕES no topo e pastas dentro de cada uma: o projeto
   * aparecia em dois lugares, o volume numa seção e a auditoria do memorial
   * dele na outra. Quem trabalha pensa "o 084-25", não "a parte de montagem do
   * 084-25".
   */
  const g = groupConversations(LISTA, "");
  const criciuma = g.find((x) => x.key === "084-25-CRICIUMA");
  assert.equal(criciuma?.items.length, 2, "o projeto aparece UMA vez, com os dois trabalhos");
});

test("o filtro esconde ITENS, não a pasta inteira", () => {
  const g = groupConversations(LISTA, "", "auditoria");
  const criciuma = g.find((x) => x.key === "084-25-CRICIUMA");
  assert.equal(criciuma?.items.length, 1);
  assert.equal(criciuma?.items[0].title, "Memorial");
});

test("pasta que fica sem item visível SOME", () => {
  const g = groupConversations(LISTA, "", "auditoria");
  assert.equal(
    g.find((x) => x.key === "040-26-CHAPECO"),
    undefined,
    "pasta vazia na tela é ruído, não informação",
  );
});

test("conversa sem pasta vive no grupo nulo, e ele vai para o FIM", () => {
  const g = groupConversations(LISTA, "");
  assert.equal(g[g.length - 1].key, null, "trabalho em aberto não empurra projeto para baixo");
  assert.equal(g[g.length - 1].items.length, 1);
});

test("a busca cobre o NOME DA PASTA, não só o título", () => {
  /*
   * Procurar por "criciuma" tem de achar o projeto — e o nome do projeto NÃO
   * está no título da conversa (que agora é só "MET · HIS"). Ele está na pasta,
   * que é justamente a mudança desta versão.
   */
  const g = groupConversations(LISTA, "criciuma");
  assert.equal(g.length, 1);
  assert.equal(g[0].key, "084-25-CRICIUMA");
  assert.equal(g[0].items.length, 2);
});

test("a busca por título continua valendo", () => {
  const g = groupConversations(LISTA, "memorial");
  assert.equal(g.length, 1);
  assert.equal(g[0].items.length, 1);
});

test("a ordem das pastas segue a recência da lista", () => {
  const g = groupConversations(LISTA, "");
  assert.deepEqual(
    g.map((x) => x.key),
    ["084-25-CRICIUMA", "040-26-CHAPECO", null],
  );
});

console.log(`\n${passed} teste(s) passaram.`);
