import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ignoreFile = readFileSync(".gitignore", "utf8");
const ignoreLines = ignoreFile
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

let failed = false;

checkIgnoreRule(".env.local");
checkIgnoreRule(".env.production.local");
checkNoDatabaseUrl(".");

if (failed) {
  process.exit(1);
}

function checkIgnoreRule(fileName) {
  const ignored =
    ignoreLines.includes(fileName) ||
    ignoreLines.includes(".env") ||
    ignoreLines.includes("*.local") ||
    ignoreLines.includes(".env*.local");

  if (ignored) {
    console.log(`OK ${fileName} ignored`);
    return;
  }

  failed = true;
  console.error(`FAIL ${fileName} ignored`);
}

function checkNoDatabaseUrl(root) {
  const findings = [];
  scan(root, findings);

  if (findings.length === 0) {
    console.log("OK No repository DATABASE_URL secret");
    return;
  }

  failed = true;
  console.error("FAIL No repository DATABASE_URL secret");
  for (const finding of findings.slice(0, 10)) {
    console.error(finding);
  }
}

function scan(dir, findings) {
  for (const entry of readdirSync(dir)) {
    if (shouldSkip(entry)) {
      continue;
    }

    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      scan(path, findings);
      continue;
    }

    if (!isTextFile(entry)) {
      continue;
    }

    const content = readFileSync(path, "utf8");

    const urls = content.match(/postgres(?:ql)?:\/\/[^\s"'`]+/gi) ?? [];
    const suspicious = urls.filter((url) => !isAllowedExampleUrl(url));

    if (suspicious.length > 0) {
      findings.push(path);
    }
  }
}

function isAllowedExampleUrl(url) {
  const normalized = url.toLowerCase();

  return (
    normalized.includes("localhost") ||
    normalized.includes("...") ||
    normalized.includes("usuario:senha") ||
    normalized.includes("user:password") ||
    normalized.includes("nexodoc:nexodoc")
  );
}

function shouldSkip(entry) {
  return (
    entry === ".git" ||
    entry === ".next" ||
    entry === ".vercel" ||
    entry === "node_modules" ||
    entry === "backups" ||
    entry === "uploads" ||
    entry.startsWith(".env")
  );
}

function isTextFile(entry) {
  return /\.(cjs|css|js|json|jsx|md|mjs|prisma|sql|ts|tsx|txt|yaml|yml)$/i.test(entry);
}
