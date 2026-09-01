/**
 * O LINK QUE VAI ATÉ O ACHADO — montar e ler. Puro → node cru.
 *
 *   node scripts/test-link-do-achado.ts   (== npm run test:link-achado)
 */
import assert from "node:assert/strict";

import { lerLinkDoAchado, linkDoAchado } from "../lib/link-do-achado.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("link do achado\n");

test("sem achado, é o link da auditoria — como sempre foi", () => {
  assert.equal(
    linkDoAchado({ base: "https://nexodoc.app", auditId: "aud-1" }),
    "https://nexodoc.app/nexo?auditoria=aud-1",
  );
  assert.equal(
    linkDoAchado({ base: "https://nexodoc.app", auditId: "aud-1", findingId: null }),
    "https://nexodoc.app/nexo?auditoria=aud-1",
  );
});

test("com achado, o link leva até ele", () => {
  assert.equal(
    linkDoAchado({ base: "https://nexodoc.app", auditId: "aud-1", findingId: "INC-014" }),
    "https://nexodoc.app/nexo?auditoria=aud-1&achado=INC-014",
  );
});

test("a barra sobrando na base não vira barra dupla", () => {
  assert.equal(
    linkDoAchado({ base: "https://nexodoc.app/", auditId: "aud-1" }),
    "https://nexodoc.app/nexo?auditoria=aud-1",
  );
});

test("os ids são escapados", () => {
  // O id vem do relatório da IA. Nunca vi um com `&`, e é exatamente por isso
  // que o dia em que vier não pode reescrever a query.
  const l = linkDoAchado({ base: "https://x.app", auditId: "a b", findingId: "c&d=e" });
  assert.equal(l, "https://x.app/nexo?auditoria=a%20b&achado=c%26d%3De");
});

test("ler devolve os dois quando os dois vêm", () => {
  assert.deepEqual(lerLinkDoAchado({ auditoria: "aud-1", achado: "INC-014" }), {
    auditId: "aud-1",
    findingId: "INC-014",
  });
});

test("achado SEM auditoria é ignorado", () => {
  /*
   * Focar um achado exige saber de qual parecer ele é. Aceitar o achado sozinho
   * faria a tela procurar um id numa auditoria que não abriu — e não achar nada,
   * sem dizer por quê.
   */
  assert.deepEqual(lerLinkDoAchado({ auditoria: null, achado: "INC-014" }), {
    auditId: null,
    findingId: null,
  });
});

test("id torto é descartado, e não propagado", () => {
  // Vira seletor CSS em `[data-achado="..."]`. Um valor livre ali é chance de
  // quebrar a consulta, e o formato do id é conhecido.
  assert.equal(lerLinkDoAchado({ auditoria: "aud-1", achado: "a b" }).findingId, null);
  assert.equal(lerLinkDoAchado({ auditoria: "aud-1", achado: "<x>" }).findingId, null);
  assert.equal(lerLinkDoAchado({ auditoria: "a b", achado: "INC-1" }).auditId, null);
});

test("vazio é nulo, e não string vazia", () => {
  assert.deepEqual(lerLinkDoAchado({ auditoria: "", achado: "" }), {
    auditId: null,
    findingId: null,
  });
});

console.log(`\n${passed} passaram`);
