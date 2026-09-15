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

export async function prepararBanco() {
  const env = ambienteDosTestes();
  rodar("npx prisma migrate deploy", env);

  const tabelas = await consultar(
    "select tablename from pg_tables where schemaname = current_schema() and tablename <> '_prisma_migrations'",
  );
  if (tabelas.length > 0) {
    const lista = tabelas.map((t) => `"${t.tablename}"`).join(", ");
    await consultar(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
  }

  rodar("node scripts/seed-desenvolvimento.ts", {
    ...env,
    NEXODOC_DEV_AUTH_EMAIL: EMAIL_DA_BATERIA,
    NEXODOC_DEV_AUTH_NAME: "Bateria",
  });
}
