/**
 * Smoke-test do título vindo do carimbo. Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-titulo-do-selo.ts
 */
import assert from "node:assert/strict";

import { tituloDoSelo } from "../modules/nexo/lib/titulo-do-selo.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const folha = (obra: string | null): SeloForLd =>
  ({
    fileName: "f.pdf",
    disciplina: null,
    folha: null,
    total: null,
    numeroFolha: null,
    arquivo: null,
    conteudo: null,
    cliente: null,
    secretaria: null,
    obra,
    fase: null,
    tituloSecao: null,
  }) as SeloForLd;

test("todas as folhas concordam — preenche", () => {
  const r = tituloDoSelo([folha("REFORMA DA CANCHA DE BOCHA"), folha("REFORMA DA CANCHA DE BOCHA")]);
  assert.equal(r.valor, "REFORMA DA CANCHA DE BOCHA");
  assert.equal(r.apoio, 2);
  assert.equal(r.divergentes, 0);
});

test("uma prancha reaproveitada não nomeia o volume", () => {
  // Dominância, não "o primeiro que aparecer".
  const r = tituloDoSelo([
    folha("CENTRO COMUNITARIO PRIMEIRA LINHA"),
    folha("REFORMA DA CANCHA DE BOCHA"),
    folha("REFORMA DA CANCHA DE BOCHA"),
    folha("REFORMA DA CANCHA DE BOCHA"),
  ]);
  assert.equal(r.valor, "REFORMA DA CANCHA DE BOCHA");
  assert.equal(r.divergentes, 1, "a divergente precisa ser contada para a tela avisar");
});

test("EMPATE não preenche — vira pergunta", () => {
  const r = tituloDoSelo([folha("OBRA A"), folha("OBRA B")]);
  assert.equal(r.valor, "", "escolher no empate seria palpite");
  assert.equal(r.divergentes, 2);
});

test("caixa e acento não criam títulos diferentes", () => {
  const r = tituloDoSelo([folha("Reforma da Praça"), folha("REFORMA DA PRACA")]);
  assert.equal(r.apoio, 2);
  assert.equal(r.divergentes, 0);
});

test("selo sem obra, ou com lixo curto, não preenche", () => {
  assert.equal(tituloDoSelo([folha(null), folha("  "), folha("ab")]).valor, "");
});

test("espaço extra do pdfjs não separa o mesmo título", () => {
  const r = tituloDoSelo([folha("REFORMA  DA   CANCHA"), folha("REFORMA DA CANCHA")]);
  assert.equal(r.apoio, 2);
});

console.log(`\n${passed} testes ok`);
