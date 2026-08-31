/**
 * O ACERVO DE APRENDIZADOS — e onde ele mora.
 *
 * Estes registros entram no prompt de toda auditoria: são as preferências, as
 * regras e as correções que o escritório ensinou. São o único estado do
 * produto que nasce do uso e não pode ser reconstruído a partir de documento
 * nenhum — perdê-los é perder trabalho humano.
 *
 * Moravam num JSON em `process.cwd()/data/`. O container da Render não declara
 * disco persistente, então o acervo zerava a cada deploy; com `autoDeploy`
 * ligado, a cada push. As telas gravavam normalmente, a subida seguinte
 * apagava, e nada no produto acusava a perda — o modo de falha mais caro que
 * existe, porque parece funcionar.
 *
 * Agora a fonte da verdade é o Postgres. O arquivo continua sendo o caminho de
 * quem roda sem banco (teste, script solto, `.env` sem `DATABASE_URL`), e é
 * lido uma vez para IMPORTAR o que já existia — ver `importarAcervoDoArquivo`.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";

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

/**
 * O banco manda quando existe.
 *
 * Não é configuração: é o mesmo `DATABASE_URL` que decide todo o resto do
 * produto. Uma chave própria aqui criaria o estado mais confuso possível —
 * banco de pé e aprendizados no disco, cada ambiente com um acervo.
 */
function usarBanco() {
  return isDatabaseConfigured();
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

/** Linha do banco → o formato que o resto do produto já consome (datas em ISO). */
function daLinha(row: {
  id: string;
  title: string;
  content: string;
  type: string;
  scope: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): AuditLearning {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: isLearningType(row.type) ? row.type : "preference",
    scope: isLearningScope(row.scope) ? row.scope : "global",
    status: isLearningStatus(row.status) ? row.status : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

/*
 * A IMPORTAÇÃO ACONTECE UMA VEZ POR PROCESSO, e só quando a tabela está vazia.
 *
 * "Tabela vazia" é a condição certa em vez de uma marca de migração: se alguém
 * já cadastrou aprendizado pelo banco, o arquivo é passado — mesclar os dois
 * ressuscitaria o que foi apagado de propósito.
 *
 * A trava em memória evita que dez requisições simultâneas na subida do
 * container disparem dez importações. `skipDuplicates` cuida do resto, porque
 * duas instâncias não compartilham esta variável.
 */
let importacaoTentada = false;

async function importarAcervoDoArquivo() {
  if (importacaoTentada) return;
  importacaoTentada = true;

  try {
    const jaTem = await getPrisma().auditLearning.count();
    if (jaTem > 0) return;

    const doArquivo = await readLearningFile();
    if (doArquivo.length === 0) return;

    await getPrisma().auditLearning.createMany({
      data: doArquivo.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type,
        scope: item.scope,
        status: item.status,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })),
      skipDuplicates: true,
    });

    console.log(
      `[learnings] ${doArquivo.length} aprendizado(s) importado(s) do arquivo para o banco.`,
    );
  } catch (error) {
    /*
     * Falha de importação NÃO derruba a leitura.
     *
     * O acervo importado é um bônus histórico; o produto precisa é de listar o
     * que existe agora. Deixar a exceção subir faria uma auditoria falhar por
     * causa de um arquivo antigo mal formado.
     */
    console.warn("[learnings] não foi possível importar o acervo do arquivo:", error);
  }
}

export async function listAuditLearnings(options: { activeOnly?: boolean; scope?: AuditLearningScope } = {}) {
  if (!usarBanco()) {
    const learnings = await readLearningFile();

    return learnings
      .filter((item) => !options.activeOnly || item.status === "active")
      .filter((item) => !options.scope || item.scope === "global" || item.scope === options.scope)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  await importarAcervoDoArquivo();

  const rows = await getPrisma().auditLearning.findMany({
    where: {
      ...(options.activeOnly ? { status: "active" } : {}),
      /*
       * `global` viaja com QUALQUER escopo pedido — é o significado da palavra
       * aqui, e a regra vinha do filtro em memória que este `where` substitui.
       */
      ...(options.scope ? { OR: [{ scope: "global" }, { scope: options.scope }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map(daLinha);
}

export async function createAuditLearning(input: Partial<AuditLearning>) {
  const learning = normalizeLearning(input);

  if (!learning) {
    throw new Error("Informe título e conteúdo do aprendizado.");
  }

  if (!usarBanco()) {
    const learnings = await readLearningFile();
    await writeLearningFile([learning, ...learnings]);
    return learning;
  }

  await importarAcervoDoArquivo();

  const row = await getPrisma().auditLearning.create({
    data: {
      id: learning.id,
      title: learning.title,
      content: learning.content,
      type: learning.type,
      scope: learning.scope,
      status: learning.status,
      createdAt: new Date(learning.createdAt),
      updatedAt: new Date(learning.updatedAt),
    },
  });

  return daLinha(row);
}

export async function updateAuditLearning(id: string, input: Partial<AuditLearning>) {
  if (!usarBanco()) {
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

  await importarAcervoDoArquivo();

  const atual = await getPrisma().auditLearning.findUnique({ where: { id } });
  if (!atual) {
    return null;
  }

  /*
   * A validação roda sobre o registro JÁ MESCLADO, e não sobre o que chegou:
   * uma edição que manda só o `status` não traz título nem conteúdo, e validar
   * o pedido cru recusaria uma pausa por "falta título".
   */
  const updated = normalizeLearning({
    ...daLinha(atual),
    ...input,
    id,
    createdAt: atual.createdAt.toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Informe título e conteúdo do aprendizado.");
  }

  const row = await getPrisma().auditLearning.update({
    where: { id },
    data: {
      title: updated.title,
      content: updated.content,
      type: updated.type,
      scope: updated.scope,
      status: updated.status,
      updatedAt: new Date(updated.updatedAt),
    },
  });

  return daLinha(row);
}

export async function deleteAuditLearning(id: string) {
  if (!usarBanco()) {
    const learnings = await readLearningFile();
    const nextLearnings = learnings.filter((item) => item.id !== id);

    if (nextLearnings.length === learnings.length) {
      return false;
    }

    await writeLearningFile(nextLearnings);
    return true;
  }

  await importarAcervoDoArquivo();

  /*
   * `deleteMany` em vez de `delete`: apagar o que não existe é um caminho
   * normal desta rota (dois cliques, duas abas), e o `delete` do Prisma
   * responde a isso com exceção. A contagem já diz o que o chamador precisa.
   */
  const { count } = await getPrisma().auditLearning.deleteMany({ where: { id } });
  return count > 0;
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
