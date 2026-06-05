import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail("DATABASE_URL is required.");
}

const backupDir = resolve(process.env.NEXODOC_BACKUP_DIR || "backups");
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputFile = join(backupDir, `nexodoc-${stamp}.dump`);

const result = spawnSync(
  "pg_dump",
  ["--format=custom", "--no-owner", "--no-privileges", "--file", outputFile, databaseUrl],
  { stdio: "inherit" },
);

if (result.error) {
  fail(`pg_dump failed: ${result.error.message}`);
}

if (result.status !== 0) {
  fail(`pg_dump exited with status ${result.status}.`);
}

console.log(`Backup created: ${outputFile}`);

function fail(message) {
  console.error(`[db:backup] ${message}`);
  process.exit(1);
}
