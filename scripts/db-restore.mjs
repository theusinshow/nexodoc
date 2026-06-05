import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const backupFile = process.env.BACKUP_FILE ? resolve(process.env.BACKUP_FILE) : "";

if (!databaseUrl) {
  fail("DATABASE_URL is required.");
}

if (!backupFile) {
  fail("BACKUP_FILE is required.");
}

if (!existsSync(backupFile)) {
  fail(`Backup file not found: ${backupFile}`);
}

if (process.env.NEXODOC_ALLOW_DB_RESTORE !== "true") {
  fail("Set NEXODOC_ALLOW_DB_RESTORE=true to run a restore.");
}

const result = spawnSync(
  "pg_restore",
  ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", databaseUrl, backupFile],
  { stdio: "inherit" },
);

if (result.error) {
  fail(`pg_restore failed: ${result.error.message}`);
}

if (result.status !== 0) {
  fail(`pg_restore exited with status ${result.status}.`);
}

console.log(`Restore completed from: ${backupFile}`);

function fail(message) {
  console.error(`[db:restore] ${message}`);
  process.exit(1);
}
