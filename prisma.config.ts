/*
 * `@next/env` é CommonJS, e a importação NOMEADA dele só funciona sob o
 * carregador do Prisma: o `node` cru não detecta o export e recusa o arquivo
 * inteiro no import. Com a forma default + destruturação, este arquivo passa a
 * ser carregável pelos dois — e é isso que permite `test:url-migracao` provar a
 * regra abaixo em vez de reescrevê-la num dublê.
 */
import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";

nextEnv.loadEnvConfig(process.cwd());

/**
 * MIGRAÇÃO NÃO PASSA PELO POOLER — e é por isso que o deploy morria.
 *
 * O sintoma (31/08/2026, Render):
 *
 *   Error: P1002 — The database server was reached but timed out.
 *   Context: Timed out trying to acquire a postgres advisory lock
 *   (SELECT pg_advisory_lock(72707369)). Timeout: 10000ms.
 *
 * O `prisma migrate deploy` serializa migrações concorrentes com um ADVISORY
 * LOCK, que no Postgres é de SESSÃO. O pooler do Neon é PgBouncer em modo
 * TRANSAÇÃO: ele não prende o cliente a um backend, então o `pg_advisory_lock`
 * é tomado numa conexão e a instrução seguinte cai em outra, que não o tem. A
 * espera nunca termina, e dez segundos depois o comando desiste — com uma
 * mensagem que fala de banco fora do ar quando o banco está perfeitamente vivo.
 *
 * A mesma pedra já estava documentada no README, para `CREATE DATABASE`: "não
 * passa pelo pooler: tire o `-pooler` do host". Aqui é a mesma coisa, na hora
 * do deploy.
 *
 * O APLICATIVO continua no pooler, e deve: é justamente ali que a conexão
 * enxuta vale, com o Neon dormindo e acordando. Quem precisa de conexão direta
 * é só a migração, que roda uma vez por deploy e dura segundos.
 */
const HOST_DO_POOLER = "-pooler.";

/**
 * A URL sem o pooler, quando dá para saber que é uma.
 *
 * SÓ MEXE EM HOST DO NEON. Reescrever a URL de um provedor desconhecido seria
 * adivinhar a topologia dele, e uma adivinhação errada aqui derruba o deploy
 * com um erro pior que o original — "servidor não encontrado", sem pista de que
 * o próprio software inventou o endereço.
 *
 * `pgbouncer=true` sai junto: é a bandeira que diz ao Prisma que a outra ponta
 * é um pooler, e numa conexão direta ela só desliga otimização à toa.
 */
export function semOPooler(url: string): { url: string; reescrita: boolean } {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    // URL que não se analisa não se reescreve. Quem reclama é o Prisma, com a
    // mensagem dele — e não este arquivo, com uma pior.
    return { url, reescrita: false };
  }

  if (!alvo.hostname.endsWith(".neon.tech")) return { url, reescrita: false };
  if (!alvo.hostname.includes(HOST_DO_POOLER)) return { url, reescrita: false };

  alvo.hostname = alvo.hostname.replace(HOST_DO_POOLER, ".");
  alvo.searchParams.delete("pgbouncer");
  return { url: alvo.toString(), reescrita: true };
}

/**
 * O fallback para localhost é conveniência de DESENVOLVIMENTO, e só.
 *
 * Em produção ele mentia: sem `DATABASE_URL`, o container subia apontando para
 * `localhost:5432` e morria com "Can't reach database server at localhost:5432
 * — please make sure your database server is running". A pessoa vai procurar
 * banco caído; o problema era variável de ambiente faltando. Custou um deploy.
 */
function urlDaMigracao(): string {
  /*
   * A DECLARADA vence sempre. Existe para o caso em que a derivação abaixo não
   * serve — outro provedor, endereço interno, host que não segue a convenção do
   * Neon. Quem a preenche está dizendo "eu sei qual é a direta", e o software
   * não tem por que discordar.
   */
  const declarada = process.env.DIRECT_DATABASE_URL?.trim();
  if (declarada) return declarada;

  const doAmbiente = process.env.DATABASE_URL?.trim();
  if (doAmbiente) {
    const { url, reescrita } = semOPooler(doAmbiente);
    if (reescrita) {
      /*
       * ANUNCIA. Reescrever a URL que o operador configurou é um gesto grande
       * demais para acontecer calado: quem lê o log do deploy precisa poder
       * ligar "a migração foi para outro host" a esta linha, em vez de
       * investigar um endereço que não configurou em lugar nenhum.
       */
      console.log(
        "[prisma] migração pelo host DIRETO do Neon (sem `-pooler`): o advisory " +
          "lock do `migrate deploy` é de sessão e não sobrevive ao PgBouncer em " +
          "modo transação. Para escolher outro endereço, defina DIRECT_DATABASE_URL.",
      );
    }
    return url;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL ausente. Em producao nao ha fallback: preencha a variavel " +
        "no painel do provedor (na Render ela e `sync: false`, entao precisa de " +
        "valor manual). Nao ha banco em localhost dentro do container.",
    );
  }

  return "postgresql://nexodoc:nexodoc@localhost:5432/nexodoc";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: urlDaMigracao(),
  },
});
