import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPgPool?: Pool;
};

/**
 * QUANTAS CONEXÕES o processo abre com o Postgres.
 *
 * Era o padrão do `pg` — 10 — sem nada dizendo que existia um número. Fica
 * explícito porque ele passa a importar: com mais de uma instância servindo, o
 * total é `max × instâncias`, e o teto do provedor é do BANCO, não do processo.
 * Estourá-lo não degrada: recusa conexão, e o produto cai inteiro.
 *
 * 10 continua sendo o valor, para não mudar comportamento junto com a correção
 * abaixo. Ao ligar escala horizontal, este número desce ou passa a apontar para
 * o pooler do provedor.
 */
function tamanhoDoPool(): number {
  const valor = Number(process.env.NEXODOC_DB_POOL_MAX);
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 10;
}

/**
 * QUANTO ESPERAR por uma conexão antes de desistir.
 *
 * O padrão do `pg` é `0` — espera para SEMPRE. Com um banco que dorme (o
 * scale-to-zero do Neon suspende após 5 min de ociosidade e não pode ser
 * desligado no plano gratuito), "para sempre" é o pior valor possível: a
 * requisição fica pendurada sem erro e sem resposta, e quem está do outro lado
 * vê a tela travada em vez de uma falha que o produto sabe explicar.
 *
 * 10s é generoso de propósito. A retomada do banco adormecido leva alguns
 * segundos, e um timeout curto transformaria a primeira visita da manhã num
 * erro — trocando um problema raro por um diário.
 */
function esperaPorConexaoMs(): number {
  const valor = Number(process.env.NEXODOC_DB_CONNECTION_TIMEOUT_MS);
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 10_000;
}

/**
 * O TRATADOR QUE IMPEDE O PROCESSO DE MORRER.
 *
 * Um `Pool` é um EventEmitter, e conexão OCIOSA pode emitir `error` sozinha —
 * o banco reiniciou, a rede caiu, ou o provedor suspendeu por ociosidade.
 * Emitter sem ouvinte de `error` não registra nada: vira exceção não capturada,
 * e o Node derruba o processo.
 *
 * O que isso custa aqui é desproporcional à causa. Uma auditoria é SSE: o
 * processo caindo não recusa uma requisição, ele mata TODAS as conexões
 * abertas — inclusive as de quem estava no meio de uma auditoria longa e não
 * tem nada a ver com o banco ter cochilado.
 *
 * NÃO tenta reconectar: o pool descarta o cliente defeituoso sozinho e abre
 * outro na próxima aquisição. O trabalho deste tratador é só existir, e deixar
 * registro do que aconteceu — um erro daqui é sintoma de infraestrutura, e
 * silenciá-lo esconderia justamente o que precisa ser investigado.
 */
function ouvirErrosDeFundo(pool: Pool) {
  pool.on("error", (erro) => {
    console.error(
      "[db] erro em conexao ociosa do pool (o pool se recupera sozinho):",
      erro instanceof Error ? erro.message : erro,
    );
  });
}

export function getPrisma() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://nexodoc:nexodoc@localhost:5432/nexodoc";

  let pool = globalForPrisma.prismaPgPool;
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: tamanhoDoPool(),
      connectionTimeoutMillis: esperaPorConexaoMs(),
    });
    /*
     * Dentro do `if`: o pool guardado em `globalThis` sobrevive ao
     * recarregamento de módulo do Next em desenvolvimento, e registrar o
     * ouvinte fora daqui acumularia um a cada edição de arquivo — até o aviso
     * de vazamento de listeners do Node, que mandaria procurar um problema que
     * não existe em produção.
     */
    ouvirErrosDeFundo(pool);
  }

  const client = new PrismaClient({ adapter: new PrismaPg(pool) });

  globalForPrisma.prisma = client;
  globalForPrisma.prismaPgPool = pool;

  return client;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}
