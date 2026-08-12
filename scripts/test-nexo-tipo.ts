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
import { contarPorTipo, groupConversations } from "../modules/nexo/lib/group-conversations.ts";
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

let t = 0;
const conv = (
  title: string,
  tipo?: TipoDeTrabalho,
  folderKey?: string,
): ConversationSummary => ({
  id: `id-${t++}`,
  title,
  updatedAt: 0,
  createdAt: 0,
  folderKey,
  tipo,
});

const lista = [
  conv("Escola Cruzeiro", "volume", "013-26"),
  conv("Escola — memorial", "auditoria", "013-26"),
  conv("Praça", "volume", "040-26"),
  conv("Conversa antiga sem tipo", undefined, "040-26"),
];

test("o recorte por tipo devolve as pastas já dentro da seção", () => {
  const g = groupConversations(lista, "", "auditoria");
  assert.equal(g.length, 1);
  assert.equal(g[0].key, "013-26");
  assert.equal(g[0].items.length, 1);
  assert.equal(g[0].items[0].title, "Escola — memorial");
});

test("conversa antiga (sem tipo) cai na seção de montagem", () => {
  const g = groupConversations(lista, "", "volume");
  const titulos = g.flatMap((x) => x.items.map((i) => i.title));
  assert.ok(titulos.includes("Conversa antiga sem tipo"));
  assert.equal(titulos.length, 3);
});

test("sem recorte, agrupa tudo (comportamento da v1)", () => {
  const g = groupConversations(lista, "");
  assert.deepEqual(g.map((x) => x.key), ["013-26", "040-26"]);
  assert.equal(g[0].items.length + g[1].items.length, 4);
});

test("filtro e busca se aplicam JUNTOS", () => {
  const g = groupConversations(lista, "escola", "volume");
  assert.equal(g.length, 1);
  assert.equal(g[0].items.length, 1);
  assert.equal(g[0].items[0].title, "Escola Cruzeiro");
});

test("as contagens são do total e ignoram busca e recorte", () => {
  assert.deepEqual(contarPorTipo(lista), { tudo: 4, volume: 3, auditoria: 1 });
});

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

test("conversa só do servidor, tipada, conta como auditoria", () => {
  // É o caso que a coluna conserta: sem disco local para corrigir o tipo.
  const soDoServidor: ConversationSummary[] = [
    { id: "a", title: "Memorial 063-26", updatedAt: 3, createdAt: 1, tipo: "auditoria" },
    { id: "b", title: "Volume 040-26", updatedAt: 2, createdAt: 1, tipo: "volume" },
    { id: "c", title: "Conversa antiga sem tipo", updatedAt: 1, createdAt: 1 },
  ];

  assert.deepEqual(contarPorTipo(soDoServidor), { tudo: 3, volume: 2, auditoria: 1 });
});

console.log(`\n${passed} testes ok`);
