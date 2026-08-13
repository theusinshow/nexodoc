/**
 * Teste da LINHA DE STATUS da home do admin (A.4).
 *
 * O que se trava aqui é o conservadorismo do veredito: qualquer dúvida rebaixa.
 * Um "operacional" otimista é pior que veredito nenhum, porque quem confiar
 * nele descobre a falha pelo cliente.
 *
 *   node scripts/test-status-do-sistema.ts   (== npm run test:status-do-sistema)
 */
import assert from "node:assert/strict";

import { normalizarCotacao, COTACAO_NAO_DECLARADA } from "../lib/cambio.ts";
import { statusDoSistema } from "../lib/status-do-sistema.ts";

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

const COTACAO = normalizarCotacao({ valor: 5, declaradaEm: "2026-08-13T00:00:00Z" });

const SAUDAVEL = {
  fluxosComChave: 23,
  fluxosTotais: 23,
  databaseConfigured: true,
  auditorias24h: 3,
  auditoriasFalhadas24h: 0,
  falhasDeProvedor: 0,
  gastoDoMesUsd: 2.84,
};

test("instância saudável é operacional e diz tudo numa linha", () => {
  const status = statusDoSistema(SAUDAVEL, COTACAO);
  assert.equal(status.veredito, "operacional");
  assert.equal(status.motivo, "");
  assert.ok(status.linha.startsWith("operacional · 3 auditorias/24h"), status.linha);
  assert.ok(status.linha.includes("sem falhas de provedor"), status.linha);
  assert.ok(status.linha.includes("≈"), status.linha);
  assert.ok(status.linha.includes("14,20"), status.linha);
});

test("sem chave nenhuma o produto está PARADO, não degradado", () => {
  const status = statusDoSistema({ ...SAUDAVEL, fluxosComChave: 0 }, COTACAO);
  assert.equal(status.veredito, "parado");
  assert.ok(status.motivo.includes("chave"), status.motivo);
});

test("sem banco também é parado — e o motivo diz o que se perde", () => {
  const status = statusDoSistema({ ...SAUDAVEL, databaseConfigured: false }, COTACAO);
  assert.equal(status.veredito, "parado");
  assert.ok(status.motivo.includes("registrado"), status.motivo);
});

test("auditoria falhada nas 24h degrada, mesmo sem incidente de provedor", () => {
  const status = statusDoSistema({ ...SAUDAVEL, auditoriasFalhadas24h: 1 }, COTACAO);
  assert.equal(status.veredito, "degradado");
  assert.ok(status.motivo.includes("auditoria falhou"), status.motivo);
});

test("chave faltando em UM fluxo já degrada", () => {
  const status = statusDoSistema({ ...SAUDAVEL, fluxosComChave: 22 }, COTACAO);
  assert.equal(status.veredito, "degradado");
  assert.ok(status.motivo.includes("1 fluxo(s) sem chave"), status.motivo);
});

test("incidente de provedor aparece na linha e no veredito", () => {
  const status = statusDoSistema({ ...SAUDAVEL, falhasDeProvedor: 2 }, COTACAO);
  assert.equal(status.veredito, "degradado");
  assert.ok(status.linha.includes("2 falhas de provedor"), status.linha);
});

test("SEM COTAÇÃO o custo sai em dólar, não some nem vira R$ 0,00", () => {
  const status = statusDoSistema(SAUDAVEL, COTACAO_NAO_DECLARADA);
  assert.ok(status.linha.includes("US$ 2,84"), status.linha);
  assert.ok(!status.linha.includes("R$ 0,00"), status.linha);
});

test("gasto desconhecido não vira parcela nenhuma", () => {
  const status = statusDoSistema({ ...SAUDAVEL, gastoDoMesUsd: null }, COTACAO);
  assert.ok(!status.linha.includes("mês"), status.linha);
  assert.ok(status.linha.includes("operacional"), status.linha);
});

test("singular e plural falam português", () => {
  const um = statusDoSistema({ ...SAUDAVEL, auditorias24h: 1 }, COTACAO);
  assert.ok(um.linha.includes("1 auditoria/24h"), um.linha);
  const zero = statusDoSistema({ ...SAUDAVEL, auditorias24h: 0 }, COTACAO);
  assert.ok(zero.linha.includes("0 auditorias/24h"), zero.linha);
});

console.log(`\n${passed} teste(s) passaram.`);
