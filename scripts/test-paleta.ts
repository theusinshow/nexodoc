/**
 * A PALETA DE COMANDOS — sem navegador.
 *
 *   node scripts/test-paleta.ts   (== npm run test:paleta)
 */
import assert from "node:assert/strict";

import {
  ACOES_DA_PALETA,
  ACOES_DE_ADMIN,
  filtrarAcoes,
  normalizar,
} from "../modules/nexo/lib/paleta.ts";
import { PARTIDAS } from "../modules/nexo/lib/partidas.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

test("as partidas da paleta sao AS MESMAS da entrada", () => {
  const naPaleta = ACOES_DA_PALETA.filter((a) => a.grupo === "Começar");
  assert.equal(naPaleta.length, PARTIDAS.length);
  for (const p of PARTIDAS) {
    assert.ok(
      naPaleta.some((a) => a.frase === p.frase),
      p.id,
    );
  }
});

test("sem texto, a paleta mostra tudo — ela e um indice, nao um quiz", () => {
  assert.equal(filtrarAcoes("").length, ACOES_DA_PALETA.length);
  assert.equal(filtrarAcoes("   ").length, ACOES_DA_PALETA.length);
});

test("acha SEM acento: quem digita rapido nao acentua", () => {
  assert.ok(filtrarAcoes("conferir").some((a) => a.id === "partida:conferir"));
  assert.ok(filtrarAcoes("MEMORIAL").some((a) => a.id === "partida:auditar"));
});

test("acha pelo SINONIMO, e nao so pelo rotulo", () => {
  assert.ok(filtrarAcoes("obras").some((a) => a.id === "ir:projetos"));
  assert.ok(
    filtrarAcoes("custo", ACOES_DE_ADMIN).some(
      (a) => a.id === "ir:admin-usage",
    ),
  );
});

test("texto que nao casa devolve lista vazia, e nao a lista inteira", () => {
  assert.equal(filtrarAcoes("xyzabc").length, 0);
});

test("a ordem declarada e preservada: comecar antes de ir para", () => {
  const grupos = filtrarAcoes("").map((a) => a.grupo);
  assert.equal(grupos.indexOf("Ir para") > grupos.lastIndexOf("Começar"), true);
});

test("NENHUMA ACAO DESTRUTIVA na paleta — ela e alcancada por acidente", () => {
  const perigosas = /apagar|excluir|remover|deletar|limpar|desativar/i;
  for (const a of [...ACOES_DA_PALETA, ...ACOES_DE_ADMIN]) {
    assert.ok(!perigosas.test(a.rotulo), a.rotulo);
  }
});

test("toda acao leva a algum lugar: ou navega, ou escreve", () => {
  for (const a of [...ACOES_DA_PALETA, ...ACOES_DE_ADMIN]) {
    assert.ok(a.href || a.frase, `${a.id} nao faz nada`);
  }
});

test("normalizar tira acento e caixa", () => {
  assert.equal(normalizar("  Conferência  "), "conferencia");
});

console.log(`\n${passed} ok`);
