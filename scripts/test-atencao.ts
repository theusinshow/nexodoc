/**
 * Teste da FAIXA DE ATENÇÃO do admin (A.6).
 *
 * O que se trava aqui é sobretudo o que NÃO entra na faixa: o opcional. Uma
 * faixa que lista pendência que ninguém precisa resolver é uma faixa que se
 * aprende a ignorar.
 *
 *   node scripts/test-atencao.ts   (== npm run test:atencao)
 */
import assert from "node:assert/strict";

import { resumoDeAtencao } from "../lib/atencao-do-admin.ts";

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

const SAUDAVEL = {
  fluxos: [
    { label: "Auditoria padrão", keyConfigured: true },
    { label: "LD - leitura principal", keyConfigured: true },
  ],
  falhas: [],
  databaseConfigured: true,
};

test("instância saudável não produz item nenhum", () => {
  assert.deepEqual(resumoDeAtencao(SAUDAVEL), []);
});

test("chave ausente é crítico e vem contado, não listado", () => {
  const itens = resumoDeAtencao({
    ...SAUDAVEL,
    fluxos: [
      { label: "A", keyConfigured: false },
      { label: "B", keyConfigured: false },
      { label: "C", keyConfigured: true },
    ],
  });
  assert.equal(itens.length, 1);
  assert.equal(itens[0].gravidade, "critico");
  assert.ok(itens[0].texto.includes("2 fluxo(s)"), itens[0].texto);
});

test("incidente entra como aviso, com as categorias", () => {
  const itens = resumoDeAtencao({
    ...SAUDAVEL,
    falhas: [
      { flow: "audit", provider: "openai", category: "rate_limit" },
      { flow: "ld-extraction", provider: "mimo", category: "timeout" },
    ],
  });
  assert.equal(itens[0].gravidade, "aviso");
  assert.ok(itens[0].texto.includes("rate_limit"), itens[0].texto);
  assert.ok(itens[0].texto.includes("timeout"), itens[0].texto);
});

test("o crítico vem antes do aviso", () => {
  const itens = resumoDeAtencao({
    fluxos: [{ label: "A", keyConfigured: false }],
    falhas: [{ flow: "audit", provider: "openai", category: "timeout" }],
    databaseConfigured: false,
  });
  assert.deepEqual(
    itens.map((i) => i.gravidade),
    ["critico", "critico", "aviso"],
  );
});

test("sem banco diz a consequência maior, não só a de tela", () => {
  const itens = resumoDeAtencao({ ...SAUDAVEL, databaseConfigured: false });
  assert.ok(itens[0].texto.includes("histórico"), itens[0].texto);
});

test("O OPCIONAL NÃO ENTRA: escritório, cotação e metas não são pendência", () => {
  // A função nem aceita esses campos — o teste existe para travar a decisão:
  // se alguém acrescentar, este assert quebra junto com a intenção.
  const itens = resumoDeAtencao(SAUDAVEL);
  assert.equal(itens.length, 0, "instância saudável e sem declarações continua limpa");
});

console.log(`\n${passed} teste(s) passaram.`);
