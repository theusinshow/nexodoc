/**
 * Smoke-test do TIPO DE TRABALHO da conversa (a seção da sidebar) e da
 * contagem por tipo. Núcleo PURO (só type-import) → roda com node cru.
 *
 *   node scripts/test-nexo-tipo.ts   (== npm run test:nexo:tipo)
 */
import assert from "node:assert/strict";

import {
  derivarTipoDeTrabalho,
  tipoDoResumo,
} from "../modules/nexo/lib/tipo-de-trabalho.ts";
import type { ConversationSummary, TipoDeTrabalho } from "../modules/nexo/lib/nexo-db.ts";

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

// ---------------------------------------------------------------- derivação

test("01 — relatório de auditoria gerado -> auditoria", () => {
  assert.equal(
    derivarTipoDeTrabalho({ results: [{ kind: "auditoria" }] }),
    "auditoria",
  );
});

test("01 — auditoria disparada e sem resultado ainda -> auditoria", () => {
  assert.equal(
    derivarTipoDeTrabalho({ auditoriaPendente: { auditId: "x" } }),
    "auditoria",
  );
});

test("02 — volume, capa, LD ou separatriz -> volume", () => {
  for (const kind of ["volume", "capa", "ld", "separatriz"]) {
    assert.equal(derivarTipoDeTrabalho({ results: [{ kind }] }), "volume", kind);
  }
});

test("a auditoria vence quando a conversa fez as duas coisas", () => {
  assert.equal(
    derivarTipoDeTrabalho({ results: [{ kind: "volume" }, { kind: "auditoria" }] }),
    "auditoria",
  );
});

test("conferência sozinha não decide -> volume (ela acontece na montagem)", () => {
  assert.equal(derivarTipoDeTrabalho({ results: [{ kind: "conferencia" }] }), "volume");
});

test("03 — nada gerado, memorial anexado -> auditoria", () => {
  assert.equal(
    derivarTipoDeTrabalho({ memorial: { name: "memorial.pdf", blobKey: "k" } }),
    "auditoria",
  );
});

test("03 — nada gerado, selos lidos -> volume", () => {
  assert.equal(derivarTipoDeTrabalho({ seloResults: [{}, {}] }), "volume");
});

test("04 — conversa ainda sem forma -> volume", () => {
  assert.equal(derivarTipoDeTrabalho({}), "volume");
  assert.equal(derivarTipoDeTrabalho({ results: [], seloResults: [] }), "volume");
});

test("registro antigo sem o campo é lido como volume", () => {
  assert.equal(tipoDoResumo({}), "volume");
  assert.equal(tipoDoResumo({ tipo: "auditoria" }), "auditoria");
});

// -------------------------------------------------- recorte e contagem

/*
 * O AGRUPAMENTO SAIU DAQUI em 01/09/2026, junto com `group-conversations.ts`.
 *
 * Aquele módulo era a barra v2 por abas, que morreu: a barra agrupa por CARTÃO
 * DE PROJETO (`cartoes-de-projeto.ts`) e a paleta, último consumidor, passou a
 * ler os mesmos cartões. As cinco checagens de recorte/busca/contagem foram com
 * ele — o que sobrou aqui é o que continua vivo: derivar o tipo e lê-lo do
 * resumo do servidor.
 */

// --- a lista do servidor precisa saber tipar (12/08/2026) --------------------
// A coluna `tipo` entrou no NexoConversation porque a listagem lê só as colunas
// de fora: sem ela, num primeiro acesso / outro navegador / cache limpo TODA
// conversa vinha sem tipo e caía em "volume". A barra lateral mostrava
// "AUDITORIAS 0" com auditorias na lista.

test("resumo do servidor SEM tipo cai no padrão (registro antigo)", () => {
  assert.equal(tipoDoResumo({}), "volume");
});

test("resumo do servidor COM tipo é respeitado", () => {
  assert.equal(tipoDoResumo({ tipo: "auditoria" }), "auditoria");
});

test("conversa só do servidor, tipada, é lida pelo tipo da coluna", () => {
  /*
   * É o caso que a coluna conserta: sem disco local para corrigir o tipo.
   *
   * A checagem era por `contarPorTipo`, que morreu com a barra v2. O FATO que
   * ela guardava continua valendo, e é este: o que decide o tipo de uma conversa
   * que só existe no servidor é a coluna, não o título nem o conteúdo.
   */
  const soDoServidor: ConversationSummary[] = [
    { id: "a", title: "Memorial 063-26", updatedAt: 3, createdAt: 1, tipo: "auditoria" },
    { id: "b", title: "Volume 040-26", updatedAt: 2, createdAt: 1, tipo: "volume" },
    { id: "c", title: "Conversa antiga sem tipo", updatedAt: 1, createdAt: 1 },
  ];

  assert.deepEqual(soDoServidor.map(tipoDoResumo), ["auditoria", "volume", "volume"]);
});

console.log(`\n${passed} testes ok`);
