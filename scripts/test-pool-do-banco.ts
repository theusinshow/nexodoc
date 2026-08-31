/**
 * Teste do POOL de conexões do Postgres.
 *
 * O que se prova aqui é a sobrevivência do processo, não a conversa com o
 * banco: um `Pool` é um EventEmitter, e conexão ociosa emite `error` sozinha
 * quando o banco reinicia, a rede cai ou o provedor suspende por ociosidade.
 * Sem ouvinte, o Node derruba o processo inteiro — e como auditoria é SSE,
 * isso mata TODAS as conexões abertas, não só a que topou com o problema.
 *
 * É por isso que o teste EMITE o erro de verdade em vez de conferir que o
 * ouvinte existe: o que importa não é haver um listener, é o processo
 * continuar de pé depois do evento.
 *
 * Não precisa de banco: o `pg` só disca na primeira consulta.
 *
 *   node scripts/test-pool-do-banco.ts   (== npm run test:pool)
 */
import assert from "node:assert/strict";

import { getPrisma } from "../lib/db.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    limpar();
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

type GlobalDoPrisma = {
  prisma?: unknown;
  prismaPgPool?: {
    listenerCount: (evento: string) => number;
    emit: (evento: string, ...args: unknown[]) => boolean;
    options?: { max?: number; connectionTimeoutMillis?: number };
  };
};

/** O cliente é memoizado em `globalThis`; sem zerar, a 2ª configuração some. */
function limpar() {
  delete process.env.NEXODOC_DB_POOL_MAX;
  delete process.env.NEXODOC_DB_CONNECTION_TIMEOUT_MS;
  const g = globalThis as unknown as GlobalDoPrisma;
  delete g.prisma;
  delete g.prismaPgPool;
}

function poolAtual() {
  getPrisma();
  const pool = (globalThis as unknown as GlobalDoPrisma).prismaPgPool;
  assert.ok(pool, "o pool deveria estar guardado em globalThis");
  return pool;
}

test("o pool tem ouvinte de erro de fundo", () => {
  assert.ok(
    poolAtual().listenerCount("error") > 0,
    "sem ouvinte, um erro de conexão ociosa vira exceção não capturada",
  );
});

test("erro de fundo NÃO derruba o processo", () => {
  const pool = poolAtual();
  // Se não houvesse ouvinte, esta linha lançaria — é assim que um EventEmitter
  // reage a `error` sem quem o escute, e é assim que o container morria quando
  // o banco cochilava.
  assert.doesNotThrow(() => {
    pool.emit("error", new Error("conexao ociosa derrubada pelo servidor"));
  });
});

test("vários erros seguidos continuam sem derrubar", () => {
  const pool = poolAtual();
  // Suspensão do banco derruba as conexões ociosas de uma vez, não uma a uma.
  assert.doesNotThrow(() => {
    for (let i = 0; i < 5; i++) {
      pool.emit("error", new Error(`queda ${i}`));
    }
  });
});

test("o tamanho do pool é 10 por padrão", () => {
  // O padrão do `pg` continua valendo: a correção não muda comportamento.
  assert.equal(poolAtual().options?.max, 10);
});

test("o tamanho do pool é configurável", () => {
  process.env.NEXODOC_DB_POOL_MAX = "4";
  assert.equal(poolAtual().options?.max, 4);
});

test("valor inválido de pool cai no padrão", () => {
  for (const v of ["", "abc", "0", "-2"]) {
    limpar();
    process.env.NEXODOC_DB_POOL_MAX = v;
    assert.equal(poolAtual().options?.max, 10, `"${v}" deveria cair no padrão`);
  }
});

test("há espera MÁXIMA por conexão — nunca 'para sempre'", () => {
  const espera = poolAtual().options?.connectionTimeoutMillis;
  // O padrão do `pg` é 0, que significa esperar indefinidamente: com um banco
  // que dorme, a requisição fica pendurada sem erro e sem resposta.
  assert.ok(typeof espera === "number" && espera > 0, "deveria haver timeout");
  // E generosa: a retomada de um banco adormecido leva segundos, então um
  // valor curto trocaria um problema raro por um erro toda manhã.
  assert.ok(espera >= 5000, "espera curta demais quebraria o primeiro acesso do dia");
});

test("a espera por conexão é configurável", () => {
  process.env.NEXODOC_DB_CONNECTION_TIMEOUT_MS = "3000";
  assert.equal(poolAtual().options?.connectionTimeoutMillis, 3000);
});

test("o pool é REAPROVEITADO entre chamadas", () => {
  // Um pool novo por chamada multiplicaria as conexões contra o banco até
  // estourar o teto do provedor — que recusa, e o produto cai inteiro.
  const primeiro = poolAtual();
  getPrisma();
  const segundo = (globalThis as unknown as GlobalDoPrisma).prismaPgPool;
  assert.equal(primeiro, segundo);
  // E o ouvinte NÃO se acumula a cada chamada: registrá-lo fora da criação
  // levaria ao aviso de vazamento de listeners do Node.
  assert.equal(primeiro.listenerCount("error"), 1);
});

limpar();
console.log(`\n${passed} teste(s) de pool OK`);
