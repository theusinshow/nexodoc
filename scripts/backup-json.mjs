/**
 * BACKUP EM JSON, porque `db:backup` depende de `pg_dump` que esta maquina nao
 * tem — e porque ele le `DATABASE_URL` do shell, e nao do `.env.local`.
 *
 * Nao substitui o dump binario: nao guarda schema nem indices, so as linhas.
 * Serve para o que precisa servir aqui — poder devolver o dado se o reset levar
 * algo que nao devia.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const prisma = getPrisma();

const TABELAS = [
  "user",
  "session",
  "organization",
  "organizationMember",
  "project",
  "projectDocument",
  "projectUpload",
  "projectEvent",
  "audit",
  "auditFeedback",
  "auditFile",
  "ldDraft",
  "ldDraftEvent",
  "documentArtifact",
  "aiTask",
  "aiModelConfig",
  "cambioConfig",
  "metaQualidadeConfig",
  "aiUsageEvent",
  "nexoConversation",
];

const dir = resolve(process.env.NEXODOC_BACKUP_DIR || "backups");
mkdirSync(dir, { recursive: true });

const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
const arquivo = join(dir, `nexodoc-${carimbo}.json`);

const dump = {};
for (const tabela of TABELAS) {
  dump[tabela] = await prisma[tabela].findMany();
  console.log(`  ${tabela.padEnd(22)} ${dump[tabela].length}`);
}

// BigInt nao sobrevive a `JSON.stringify` sem ajuda, e Date vira ISO sozinho.
writeFileSync(
  arquivo,
  JSON.stringify(dump, (_chave, valor) => (typeof valor === "bigint" ? String(valor) : valor), 2),
  "utf8",
);

console.log(`\nBackup: ${arquivo}`);
await prisma.$disconnect();
