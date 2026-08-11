/**
 * Teste das regras da CONVERSA QUE ATRAVESSA A REDE.
 *
 * Três coisas erram em silêncio quando ninguém as testa, e as três estão aqui:
 *
 *   1. o servidor aceitar um registro torto e gravar lixo com aparência de ok;
 *   2. o registro grande demais estourar em algum lugar mais fundo em vez de
 *      voltar com um motivo — o testador acha que salvou;
 *   3. a fusão das listas SUMIR com conversa. Este é o caro: uma conversa que
 *      ainda não subiu não existe no servidor, e "não existe no servidor"
 *      nunca pode virar ordem de apagar o local.
 *
 * Nenhuma delas precisa de banco, de rede ou de tela para ser provada.
 *
 *   node scripts/test-nexo-conversa-remota.ts   (== npm run test:nexo:conversa-remota)
 */
import assert from "node:assert/strict";

import {
  LIMITE_BYTES,
  fundirListas,
  resumoDoRegistro,
  validarRegistro,
  type RegistroDaConversa,
  type ResumoDaConversa,
} from "../server/nexo/conversa-remota.ts";

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

function registro(over: Partial<RegistroDaConversa> = {}): RegistroDaConversa {
  return {
    id: "abc",
    title: "REFORMA DA ESCOLA",
    createdAt: 1_000,
    updatedAt: 2_000,
    messages: [],
    seloResults: [],
    results: [],
    ...over,
  };
}

function resumo(over: Partial<ResumoDaConversa> = {}): ResumoDaConversa {
  return { id: "x", title: "t", createdAt: 1, updatedAt: 1, ...over };
}

// ---------------------------------------------------------------------------
// Validar
// ---------------------------------------------------------------------------

test("o registro completo passa", () => {
  const v = validarRegistro(registro());
  assert.equal(v.ok, true);
});

test("o miolo desconhecido passa inteiro — o formato é schemaless", () => {
  const v = validarRegistro(registro({ campoQueAindaNaoExiste: { a: [1, 2] } }));
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.deepEqual(v.registro.campoQueAindaNaoExiste, { a: [1, 2] });
});

test("sem id não passa", () => {
  const v = validarRegistro(registro({ id: "" }));
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.match(v.motivo, /id/);
});

test("sem título não passa — título vira coluna e a lista o lê", () => {
  const v = validarRegistro(registro({ title: "   " }));
  assert.equal(v.ok, false);
});

test("data inválida não passa", () => {
  assert.equal(validarRegistro(registro({ updatedAt: 0 })).ok, false);
  assert.equal(validarRegistro(registro({ createdAt: Number.NaN })).ok, false);
  assert.equal(
    validarRegistro(registro({ updatedAt: "ontem" as unknown as number })).ok,
    false,
  );
});

test("folderKey de tipo errado não passa", () => {
  const v = validarRegistro(registro({ folderKey: 84 as unknown as string }));
  assert.equal(v.ok, false);
});

test("array e null não são registro", () => {
  assert.equal(validarRegistro([]).ok, false);
  assert.equal(validarRegistro(null).ok, false);
  assert.equal(validarRegistro("{}").ok, false);
});

test("acima do teto volta com o motivo, e o motivo cita os megabytes", () => {
  const gordo = registro({ payload: "x".repeat(LIMITE_BYTES) });
  const v = validarRegistro(gordo);
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.match(v.motivo, /grande demais/);
  assert.match(v.motivo, /MB/);
});

test("o tamanho medido é o do JSON, não o do objeto", () => {
  const v = validarRegistro(registro());
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(v.bytes, new TextEncoder().encode(JSON.stringify(registro())).length);
});

test("ciclo não derruba o servidor — volta como não serializável", () => {
  const r = registro() as Record<string, unknown>;
  r.eu = r;
  const v = validarRegistro(r);
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.match(v.motivo, /serializ/);
});

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

test("o resumo leva só o que vira coluna", () => {
  const r = resumoDoRegistro(registro({ folderKey: "084-25" }));
  assert.deepEqual(r, {
    id: "abc",
    title: "REFORMA DA ESCOLA",
    createdAt: 1_000,
    updatedAt: 2_000,
    folderKey: "084-25",
  });
});

test("auditoria pendente vira booleano no resumo", () => {
  const r = resumoDoRegistro(registro({ auditoriaPendente: { auditId: "a1" } }));
  assert.equal(r.temAuditoriaPendente, true);
});

test("sem auditoria pendente o campo nem aparece", () => {
  assert.equal("temAuditoriaPendente" in resumoDoRegistro(registro()), false);
});

// ---------------------------------------------------------------------------
// Fundir — o caro
// ---------------------------------------------------------------------------

test("o que só existe no disco FICA (sincronizar pode ter falhado)", () => {
  const out = fundirListas([resumo({ id: "local" })], []);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "local");
  assert.equal(out[0].soNoServidor, false);
});

test("o que só existe no servidor entra MARCADO", () => {
  const out = fundirListas([], [resumo({ id: "remota" })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].soNoServidor, true);
});

test("a remota mais nova vence, e deixa de ser 'só no servidor'", () => {
  const out = fundirListas(
    [resumo({ id: "a", title: "velho", updatedAt: 10 })],
    [resumo({ id: "a", title: "novo", updatedAt: 20 })],
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "novo");
  assert.equal(out[0].soNoServidor, false);
});

test("o tipo do disco sobrevive quando a remota vence sem tipo", () => {
  // A listagem do servidor le so as colunas de fora, e `tipo` nao e uma delas.
  // Sem a guarda, toda auditoria editada noutra maquina voltaria para a secao
  // de montagem na proxima sincronizacao.
  const out = fundirListas(
    [resumo({ id: "a", updatedAt: 10, tipo: "auditoria" })],
    [resumo({ id: "a", updatedAt: 20 })],
  );
  assert.equal(out[0].tipo, "auditoria");
  assert.equal(out[0].soNoServidor, false);
});

test("o tipo que a remota traz vence o do disco", () => {
  const out = fundirListas(
    [resumo({ id: "a", updatedAt: 10, tipo: "volume" })],
    [resumo({ id: "a", updatedAt: 20, tipo: "auditoria" })],
  );
  assert.equal(out[0].tipo, "auditoria");
});

test("a local mais nova vence", () => {
  const out = fundirListas(
    [resumo({ id: "a", title: "novo", updatedAt: 30 })],
    [resumo({ id: "a", title: "velho", updatedAt: 20 })],
  );
  assert.equal(out[0].title, "novo");
});

test("empate resolve para o local — é o que a pessoa está vendo", () => {
  const out = fundirListas(
    [resumo({ id: "a", title: "local", updatedAt: 20 })],
    [resumo({ id: "a", title: "servidor", updatedAt: 20 })],
  );
  assert.equal(out[0].title, "local");
});

test("a saída sai ordenada da mais nova para a mais velha", () => {
  const out = fundirListas(
    [resumo({ id: "a", updatedAt: 10 }), resumo({ id: "b", updatedAt: 50 })],
    [resumo({ id: "c", updatedAt: 30 })],
  );
  assert.deepEqual(
    out.map((c) => c.id),
    ["b", "c", "a"],
  );
});

test("nenhuma conversa se perde na fusão", () => {
  const locais = [resumo({ id: "a" }), resumo({ id: "b" })];
  const remotas = [resumo({ id: "b" }), resumo({ id: "c" })];
  const out = fundirListas(locais, remotas);
  assert.deepEqual(
    out.map((c) => c.id).sort(),
    ["a", "b", "c"],
  );
});

test("as duas listas vazias devolvem lista vazia, não estouram", () => {
  assert.deepEqual(fundirListas([], []), []);
});

test("fundir não altera as listas recebidas", () => {
  const locais = [resumo({ id: "a", updatedAt: 10 })];
  const remotas = [resumo({ id: "a", updatedAt: 20 })];
  fundirListas(locais, remotas);
  assert.equal("soNoServidor" in locais[0], false);
  assert.equal("soNoServidor" in remotas[0], false);
});

console.log(`\n${passed} verificações passaram.`);
