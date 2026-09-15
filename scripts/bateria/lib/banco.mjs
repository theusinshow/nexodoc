// Prepara o nexodoc_teste para uma rodada: migrações em dia, tabelas vazias e o
// mínimo para entrar (usuário da bateria como ADMIN da org-prosul).
import { spawnSync } from "node:child_process";

import pg from "pg";

import { EMAIL_DA_BATERIA, ambienteDosTestes, urlDaBateria } from "./ambiente.mjs";

function cliente() {
  const url = new URL(urlDaBateria());
  url.searchParams.delete("channel_binding");
  return new pg.Client({ connectionString: url.toString() });
}

export async function consultar(sql, params = []) {
  const c = cliente();
  await c.connect();
  try {
    return (await c.query(sql, params)).rows;
  } finally {
    await c.end();
  }
}

function rodar(comando, env) {
  const r = spawnSync(comando, { shell: true, env, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`falhou: ${comando}\n${r.stdout ?? ""}\n${r.stderr ?? ""}`);
  }
}

/*
 * TABELAS DE REFERÊNCIA: dado inserido por MIGRAÇÃO, não por quem usa o
 * sistema. `migrate deploy` não reexecuta uma migração já aplicada — a linha
 * de `INSERT` de `20260814013954_escritorio_passo_1` só roda uma vez na vida
 * do banco. Se o TRUNCATE de `prepararBanco()` apagar esta tabela, ninguém a
 * recria depois, e toda chamada seguinte quebra igual (medido em 14/09/2026,
 * no nexodoc_teste: "org-prosul" sumia e `seed-desenvolvimento.ts` parava em
 * "Organizacao org-prosul nao existe"). A bateria apaga o TRABALHO
 * (projetos, achados, sessões, membros...), não a organização em si — quem
 * é ADMIN dela é o seed, chamado logo abaixo.
 */
const TABELAS_DE_REFERENCIA = ["Organization"];

export async function prepararBanco() {
  const env = ambienteDosTestes();
  rodar("npx prisma migrate deploy", env);

  const tabelas = await consultar(
    "select tablename from pg_tables where schemaname = current_schema() and tablename <> '_prisma_migrations'",
  );
  const paraEsvaziar = tabelas.filter((t) => !TABELAS_DE_REFERENCIA.includes(t.tablename));
  if (paraEsvaziar.length > 0) {
    /*
     * CASCADE aqui só alcança quem tem FK apontando para as tabelas LISTADAS
     * (as de trabalho). "Organization" é o lado referenciado — não o que
     * referencia — por "OrganizationMember", "Project" e "AuditLearning"
     * (conferido em information_schema.referential_constraints em
     * 14/09/2026), então truncar as três não arrasta "Organization" de volta
     * por tabela nenhuma: CASCADE nunca sobe para o lado pai.
     */
    const lista = paraEsvaziar.map((t) => `"${t.tablename}"`).join(", ");
    await consultar(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
  }

  /*
   * SE FALTAR "org-prosul", ninguém a recria sozinho: `migrate deploy` não
   * reexecuta a migração que a insere, e sem ela o seed abaixo para em
   * "Organizacao org-prosul nao existe", sem pista de como voltar — foi
   * exatamente o estado desta máquina em 14/09/2026, depois de rodadas com a
   * primeira versão deste arquivo (que truncava "Organization" junto com o
   * resto). Reaplica o MESMO `INSERT` de
   * `prisma/migrations/20260814013954_escritorio_passo_1/migration.sql`,
   * valor por valor: não é dado novo, é o dado que a migração já define, e o
   * `ON CONFLICT` torna repetir isto sempre seguro.
   */
  await consultar(
    `INSERT INTO "Organization" ("id", "name", "slug", "ownerEmail", "createdAt", "updatedAt")
     VALUES ('org-prosul', 'PROSUL', 'prosul', 'matheusmendes077@gmail.com', NOW(), NOW())
     ON CONFLICT ("slug") DO NOTHING`,
  );

  rodar("node scripts/seed-desenvolvimento.ts", {
    ...env,
    NEXODOC_DEV_AUTH_EMAIL: EMAIL_DA_BATERIA,
    NEXODOC_DEV_AUTH_NAME: "Bateria",
  });
}
