/**
 * A URL QUE A MIGRAÇÃO USA — o conserto do deploy de 31/08/2026.
 *
 *   Error: P1002 — Timed out trying to acquire a postgres advisory lock
 *   (SELECT pg_advisory_lock(72707369)). Timeout: 10000ms.
 *
 * O advisory lock do `migrate deploy` é de SESSÃO; o pooler do Neon é PgBouncer
 * em modo TRANSAÇÃO e não prende o cliente a um backend. O lock some entre uma
 * instrução e a seguinte, e o comando morre em dez segundos falando de banco
 * fora do ar — com o banco vivo. Ver `prisma.config.ts`.
 *
 * Núcleo PURO → node cru:
 *
 *   node scripts/test-url-de-migracao.ts   (== npm run test:url-migracao)
 */
import assert from "node:assert/strict";

import { semOPooler } from "../prisma.config.ts";

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

// O host REAL do log do deploy que motivou isto.
const POOLED =
  "postgresql://user:senha@ep-nameless-bird-ac329927-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";

test("o host do log perde o -pooler", () => {
  const { url, reescrita } = semOPooler(POOLED);
  assert.equal(reescrita, true);
  assert.match(url, /ep-nameless-bird-ac329927\.sa-east-1\.aws\.neon\.tech/);
  assert.doesNotMatch(url, /-pooler/);
});

test("o resto da URL fica intacto — usuário, senha, banco e sslmode", () => {
  const { url } = semOPooler(POOLED);
  const u = new URL(url);
  assert.equal(u.username, "user");
  assert.equal(u.password, "senha");
  assert.equal(u.pathname, "/neondb");
  assert.equal(u.searchParams.get("sslmode"), "require");
});

test("`pgbouncer=true` sai junto — na direta ela só desliga otimização à toa", () => {
  const { url } = semOPooler(`${POOLED}&pgbouncer=true`);
  assert.equal(new URL(url).searchParams.get("pgbouncer"), null);
});

test("host do Neon SEM pooler não é tocado", () => {
  const direta =
    "postgresql://user:senha@ep-nameless-bird-ac329927.sa-east-1.aws.neon.tech/neondb";
  const { url, reescrita } = semOPooler(direta);
  assert.equal(reescrita, false);
  assert.equal(url, direta);
});

/*
 * A GUARDA QUE IMPORTA. Reescrever a URL de um provedor desconhecido seria
 * adivinhar a topologia dele, e a adivinhação errada derruba o deploy com um
 * erro PIOR que o original: "servidor não encontrado", sem nenhuma pista de que
 * foi o próprio software que inventou o endereço.
 */
test("provedor que NÃO é Neon fica como está, mesmo com -pooler no nome", () => {
  const outro = "postgresql://user:senha@db-pooler.exemplo.com:5432/app";
  const { url, reescrita } = semOPooler(outro);
  assert.equal(reescrita, false);
  assert.equal(url, outro);
});

test("localhost do desenvolvimento fica como está", () => {
  const local = "postgresql://nexodoc:nexodoc@localhost:5432/nexodoc";
  assert.equal(semOPooler(local).url, local);
});

test("URL que não se analisa não se reescreve", () => {
  // Quem reclama é o Prisma, com a mensagem dele — não este arquivo, com pior.
  const lixo = "isto não é uma URL";
  const { url, reescrita } = semOPooler(lixo);
  assert.equal(reescrita, false);
  assert.equal(url, lixo);
});

console.log(`\n${passed} teste(s) ok`);
