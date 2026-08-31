/** Regressões estruturais que não exigem banco migrado. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FALHOU  ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260831143000_aprendizados_por_escritorio/migration.sql",
  "utf8",
);
const learningRoutes = [
  readFileSync("app/api/learnings/route.ts", "utf8"),
  readFileSync("app/api/learnings/[id]/route.ts", "utf8"),
].join("\n");
const auditRoute = readFileSync("app/api/audit/route.ts", "utf8");
const chatHistory = readFileSync("server/audit/chat/historico.ts", "utf8");
const projectStore = readFileSync("lib/project-store.ts", "utf8");
const databaseAdapter = readFileSync("lib/db.ts", "utf8");

test("AuditLearning tem organizationId obrigatório e relação no schema", () => {
  assert.match(schema, /model AuditLearning \{[\s\S]*organizationId\s+String\b/);
  assert.match(schema, /organization\s+Organization\s+@relation/);
  assert.match(schema, /@@index\(\[organizationId, status, scope, updatedAt\]\)/);
});

test("migration atribui o legado explicitamente à PROSUL antes do NOT NULL", () => {
  const backfill = migration.indexOf("SET \"organizationId\" = 'org-prosul'");
  const notNull = migration.indexOf('ALTER COLUMN "organizationId" SET NOT NULL');
  assert.ok(backfill >= 0 && notNull > backfill);
  assert.match(migration, /AuditLearning_organizationId_fkey/);
});

test("rotas e prompts propagam organizationId do ator", () => {
  assert.match(learningRoutes, /actor\.organizationId/);
  assert.match(auditRoute, /listAuditLearnings\(\{\s*organizationId:\s*actor\.organizationId/s);
  assert.match(chatHistory, /organizationId:\s*args\.organizationId/);
});

test("artefato valida auditoria e rascunho contra o mesmo projectId", () => {
  assert.match(projectStore, /id:\s*input\.auditId,\s*projectId:\s*input\.projectId!/);
  assert.match(projectStore, /id:\s*input\.ldDraftId,\s*projectId:\s*input\.projectId!/);
  assert.match(projectStore, /throw new InvalidArtifactRelation\(\)/);
});

test("adapter do Prisma respeita o schema declarado na URL", () => {
  assert.match(databaseAdapter, /searchParams\.get\("schema"\)/);
  assert.match(databaseAdapter, /new PrismaPg\(pool, schema \? \{ schema \} : undefined\)/);
});

console.log(`\n${passed} teste(s) estruturais do P2 passaram.`);
