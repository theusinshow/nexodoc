import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type AuditLearningType = "preference" | "rule" | "example" | "correction";
export type AuditLearningScope = "global" | "memorial" | "volume";
export type AuditLearningStatus = "active" | "paused";

export type AuditLearning = {
  id: string;
  title: string;
  content: string;
  type: AuditLearningType;
  scope: AuditLearningScope;
  status: AuditLearningStatus;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_LEARNINGS_FILE = "nexodoc-learnings.json";

function getLearningsFilePath() {
  return process.env.NEXODOC_LEARNINGS_FILE?.trim() || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", DEFAULT_LEARNINGS_FILE);
}

function isLearningType(value: unknown): value is AuditLearningType {
  return value === "preference" || value === "rule" || value === "example" || value === "correction";
}

function isLearningScope(value: unknown): value is AuditLearningScope {
  return value === "global" || value === "memorial" || value === "volume";
}

function isLearningStatus(value: unknown): value is AuditLearningStatus {
  return value === "active" || value === "paused";
}

function normalizeLearning(item: Partial<AuditLearning>): AuditLearning | null {
  const title = String(item.title ?? "").trim();
  const content = String(item.content ?? "").trim();

  if (!title || !content) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: String(item.id || crypto.randomUUID()),
    title: title.slice(0, 120),
    content: content.slice(0, 2000),
    type: isLearningType(item.type) ? item.type : "preference",
    scope: isLearningScope(item.scope) ? item.scope : "global",
    status: isLearningStatus(item.status) ? item.status : "active",
    createdAt: item.createdAt ?? now,
    updatedAt: item.updatedAt ?? now,
  };
}

async function readLearningFile() {
  try {
    const raw = await readFile(getLearningsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeLearning(item as Partial<AuditLearning>))
      .filter((item): item is AuditLearning => Boolean(item));
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeLearningFile(learnings: AuditLearning[]) {
  const filePath = getLearningsFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(learnings, null, 2)}\n`, "utf8");
}

export async function listAuditLearnings(options: { activeOnly?: boolean; scope?: AuditLearningScope } = {}) {
  const learnings = await readLearningFile();

  return learnings
    .filter((item) => !options.activeOnly || item.status === "active")
    .filter((item) => !options.scope || item.scope === "global" || item.scope === options.scope)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createAuditLearning(input: Partial<AuditLearning>) {
  const learning = normalizeLearning(input);

  if (!learning) {
    throw new Error("Informe título e conteúdo do aprendizado.");
  }

  const learnings = await readLearningFile();
  await writeLearningFile([learning, ...learnings]);

  return learning;
}

export async function updateAuditLearning(id: string, input: Partial<AuditLearning>) {
  const learnings = await readLearningFile();
  const index = learnings.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  const updated = normalizeLearning({
    ...learnings[index],
    ...input,
    id,
    createdAt: learnings[index].createdAt,
    updatedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Informe título e conteúdo do aprendizado.");
  }

  learnings[index] = updated;
  await writeLearningFile(learnings);

  return updated;
}

export async function deleteAuditLearning(id: string) {
  const learnings = await readLearningFile();
  const nextLearnings = learnings.filter((item) => item.id !== id);

  if (nextLearnings.length === learnings.length) {
    return false;
  }

  await writeLearningFile(nextLearnings);
  return true;
}

export function formatAuditLearningsForPrompt(learnings: AuditLearning[]) {
  if (learnings.length === 0) {
    return "Nenhum aprendizado ativo cadastrado.";
  }

  return learnings
    .slice(0, 20)
    .map((item, index) => {
      return [
        `${index + 1}. ${item.title}`,
        `Tipo: ${item.type}`,
        `Escopo: ${item.scope}`,
        `Conteúdo: ${item.content}`,
      ].join("\n");
    })
    .join("\n\n");
}
