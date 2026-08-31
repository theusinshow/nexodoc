/**
 * QUEM ESTÁ SEGURANDO O LOCK DA MIGRAÇÃO — e como soltá-lo.
 *
 *   node scripts/destravar-migracao.mjs            (só olha)
 *   node scripts/destravar-migracao.mjs --limpar   (derruba quem segura)
 *
 * O QUE ACONTECEU (31/08/2026, deploy na Render):
 *
 *   Error: P1002 — Timed out trying to acquire a postgres advisory lock
 *   (SELECT pg_advisory_lock(72707369)). Timeout: 10000ms.
 *
 * O `prisma migrate deploy` serializa migrações concorrentes com um advisory
 * lock, que no Postgres é de SESSÃO. O pooler do Neon é PgBouncer em modo
 * TRANSAÇÃO: ele devolve a conexão de servidor ao pool sem encerrar a sessão.
 * Um `migrate deploy` que morra segurando o lock deixa o lock PENDURADO num
 * backend ocioso — e ele sobrevive ao container que o pediu.
 *
 * MEDIDO, não deduzido (o experimento está no histórico da sessão):
 *
 *   tomou o lock pelo pooler (backend pid 1453)
 *   cliente desconectou SEM soltar o lock
 *     pelo pooler   conseguiu pegar? true    <- MESMO backend: lock é reentrante
 *     direto        conseguiu pegar? false   <- está mesmo preso
 *   segurando o lock agora: [ { pid: 1453, granted: true, state: 'idle' } ]
 *
 * As duas metades importam. A de baixo explica por que todo deploy seguinte
 * expira; a de cima explica por que o mesmo comando às vezes PASSA — o pooler
 * roteou para o backend que já tinha o lock, e aí duas migrações concorrentes
 * rodariam juntas, que é exatamente o que o lock existe para impedir.
 *
 * O conserto permanente é `prisma.config.ts`: migração vai pelo host DIRETO.
 * Este script é para o lock que JÁ ficou pendurado — uma conexão direta espera
 * por ele igual, então trocar a URL não solta o que já está preso.
 *
 * COMO SOLTAR SEM ESTE SCRIPT: o Neon suspende o compute após ociosidade, e a
 * suspensão encerra todas as sessões. Esperar funciona; só demora.
 */
import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

/** O id que o Prisma usa. Sai do próprio erro: `pg_advisory_lock(72707369)`. */
const LOCK_DO_PRISMA = 72707369;

function urlDireta() {
  const declarada = process.env.DIRECT_DATABASE_URL?.trim();
  if (declarada) return declarada;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "DATABASE_URL ausente. Rode com a URL do ambiente que travou:\n" +
        '  DATABASE_URL="<url do Neon>" node scripts/destravar-migracao.mjs',
    );
    process.exit(1);
  }
  /*
   * DIRETO, SEMPRE. Perguntar ao pooler quem segura o lock é perguntar a UM
   * backend do pool — e a resposta seria sobre a conexão que ele escolheu, não
   * sobre o banco. Um "ninguém está segurando" falso é pior que nenhuma
   * resposta, porque encerra a investigação.
   */
  return url.replace("-pooler.", ".");
}

const limpar = process.argv.includes("--limpar");
const url = urlDireta();

/*
 * DIZ QUAL BANCO ESTÁ OLHANDO — sem isto o script tinha um jeito silencioso de
 * enganar: quem esquecesse de passar a URL de produção inspecionaria o banco de
 * desenvolvimento, leria "ninguém segura o lock" e concluiria que o deploy
 * falha por outro motivo. Um "está limpo" sobre o banco errado é pior que
 * nenhuma resposta.
 *
 * Sem credencial: o que identifica é host + nome do banco.
 */
const endereco = new URL(url);
console.log(
  `Olhando: ${endereco.hostname}${endereco.pathname}` +
    (endereco.hostname.includes("-pooler.") ? "  (ATENÇÃO: ainda é o pooler)" : ""),
);
console.log("");

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

const { rows } = await cliente.query(
  `SELECT l.pid,
          l.granted,
          a.state,
          a.application_name,
          a.backend_start,
          to_char(now() - a.state_change, 'HH24h MIm SSs') AS parado_ha
     FROM pg_locks l
     LEFT JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory' AND l.objid = $1
    ORDER BY l.granted DESC`,
  [LOCK_DO_PRISMA],
);

if (rows.length === 0) {
  console.log(
    `Ninguém segura o lock ${LOCK_DO_PRISMA}. Se o deploy ainda expira, a causa é outra —\n` +
      "confira se a migração está indo pelo host direto (o log do deploy anuncia).",
  );
} else {
  console.log(`Segurando o lock ${LOCK_DO_PRISMA}:\n`);
  for (const r of rows) {
    console.log(
      `  pid ${r.pid} · ${r.granted ? "SEGURA" : "esperando"} · estado=${r.state} · ` +
        `parado há ${r.parado_ha ?? "?"} · ${r.application_name || "sem nome"}`,
    );
  }
  if (!limpar) {
    console.log(
      "\nNada foi alterado. Para derrubar essas sessões (e liberar o deploy):\n" +
        "  node scripts/destravar-migracao.mjs --limpar",
    );
  } else {
    console.log("");
    for (const r of rows.filter((x) => x.granted)) {
      await cliente.query("SELECT pg_terminate_backend($1)", [r.pid]);
      console.log(`  derrubei o backend ${r.pid} — o lock dele foi solto`);
    }
    console.log("\nRode o deploy de novo.");
  }
}

await cliente.end();
