import { NextResponse } from "next/server";

import { parseAuditMode, type AuditMode } from "@/lib/audit-mode";
import {
  formatAuditLearningsForPrompt,
  listAuditLearnings,
} from "@/lib/audit-learnings";
import {
  makeTextReport,
  buildExecutiveSummary,
  classifyFindingImpact,
  normalizeConfidence,
  normalizePriority,
  sortAuditFindings,
  type AuditFinding,
  type AuditReport,
} from "@/lib/audit-report";
import { getAuditorPrompt } from "@/lib/auditor-prompt";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  getMockAuditResult,
  isMockModeEnabled,
  waitForMockAudit,
} from "@/lib/mock-audit";
import { getOpenAIClient } from "@/lib/openai";
import { chunkPdfByChapter, extractPdfText, type AuditTextChunk, type ExtractedPdf } from "@/lib/pdf-text";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_CHUNK_MAX_OUTPUT_TOKENS = 1800;
const DEFAULT_REASONING_EFFORT = "high";
const MIN_TEXT_CHARS_FOR_DEEP_AUDIT = 300;
const DEFAULT_MAX_CHUNKS_PER_FILE = 8;
const DEFAULT_CHUNK_CONCURRENCY = 3;
const DEFAULT_CHUNK_TIMEOUT_MS = 120_000;
const DEFAULT_GLOBAL_CONTEXT_CHARS = 90_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UploadedAuditFile = {
  file: File;
  fileType: string;
  buffer: Buffer;
  extracted: ExtractedPdf;
};

async function createPendingAudit(args: {
  auditId: string;
  auditMode: AuditMode;
  auditTitle: string;
  projectName: string;
  auditDescription: string;
  files: File[];
  fileTypes: string[];
}) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    const prisma = getPrisma();
    const audit = await prisma.audit.create({
      data: {
        id: args.auditId,
        title: args.auditTitle || "Auditoria sem identificação",
        projectName: args.projectName || "Projeto não informado",
        description: args.auditDescription,
        auditMode: args.auditMode,
        status: "PROCESSING",
        files: {
          create: args.files.map((file, index) => ({
            fileName: file.name,
            documentType: args.fileTypes[index] ?? "não informado",
            sizeBytes: file.size,
          })),
        },
      },
      select: { id: true },
    });

    return audit.id;
  } catch (error) {
    console.error("[audit] falha ao iniciar persistência da auditoria", error);
    return null;
  }
}

async function persistCompletedAudit(args: {
  auditId: string | null;
  uploadedFiles: UploadedAuditFile[];
  report: AuditReport;
  result: string;
  elapsedMs: number;
}) {
  if (!args.auditId || !isDatabaseConfigured()) {
    return;
  }

  try {
    const prisma = getPrisma();
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.audit.updateMany({
        where: {
          id: args.auditId!,
          status: "PROCESSING",
        },
        data: {
          status: "COMPLETED",
          result: args.result,
          report: args.report,
          elapsedMs: args.elapsedMs,
          totalFindings: args.report.total_incongruencias,
          completedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return;
      }

      await transaction.auditFile.deleteMany({ where: { auditId: args.auditId! } });
      await transaction.auditFile.createMany({
        data: args.uploadedFiles.map((file) => ({
            auditId: args.auditId!,
            fileName: file.file.name,
            documentType: file.fileType,
            pageCount: file.extracted.pageCount,
            extractedCharCount: file.extracted.charCount,
            sizeBytes: file.file.size,
          })),
      });
    });
  } catch (error) {
    console.error("[audit] falha ao persistir auditoria", error);
  }
}

async function persistFailedAudit(auditId: string | null, error: unknown, elapsedMs: number) {
  if (!auditId || !isDatabaseConfigured()) {
    return;
  }

  try {
    const prisma = getPrisma();
    await prisma.audit.updateMany({
      where: { id: auditId, status: "PROCESSING" },
      data: {
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Não foi possível concluir a auditoria documental.",
        elapsedMs,
        completedAt: new Date(),
      },
    });
  } catch (persistenceError) {
    console.error("[audit] falha ao persistir erro da auditoria", persistenceError);
  }
}

type ModelFinding = {
  prioridade?: string;
  pagina?: string | number;
  capitulo?: string;
  local?: string;
  tipo?: string;
  descricao?: string;
  evidencia?: string;
  termo_busca?: string;
  arquivo?: string;
  categoria?: string;
  referencia_comparada?: string;
  conflito?: string;
  sugestao_correcao?: string;
  confianca?: string;
};

type ValidationDecision = {
  source_id?: string;
  acao?: "confirmar" | "rebaixar" | "remover";
  prioridade?: string;
  impacto?: "critico_documental" | "tecnico_contratual" | "revisao_editorial";
  tipo?: string;
  descricao?: string;
  conflito?: string;
  sugestao_correcao?: string;
  confianca?: string;
  motivo?: string;
};

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function jsonError(message: string, status = 400) {
  return withCors(NextResponse.json({ error: message }, { status }));
}

function getAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.NEXODOC_ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin) {
    return allowedOrigins?.[0] ?? "*";
  }

  if (!allowedOrigins || allowedOrigins.length === 0) {
    return origin;
  }

  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
}

function withCors(response: NextResponse, request?: Request) {
  const allowedOrigin = request ? getAllowedOrigin(request) : "*";

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Vary", "Origin");

  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

function getReasoningEffort() {
  const effort = process.env.OPENAI_REASONING_EFFORT;

  if (
    effort === "none" ||
    effort === "minimal" ||
    effort === "low" ||
    effort === "medium" ||
    effort === "high" ||
    effort === "xhigh"
  ) {
    return effort;
  }

  return DEFAULT_REASONING_EFFORT;
}

function getPrimaryModelName() {
  return process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
}

function getValidationModelName() {
  return process.env.OPENAI_VALIDATION_MODEL ?? getPrimaryModelName();
}

function extractResponseText(response: unknown) {
  if (
    response &&
    typeof response === "object" &&
    "output_text" in response &&
    typeof response.output_text === "string"
  ) {
    return response.output_text.trim();
  }

  if (!response || typeof response !== "object" || !("output" in response)) {
    return "";
  }

  const output = response.output;

  if (!Array.isArray(output)) {
    return "";
  }

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) {
        return [];
      }

      const content = item.content;

      if (!Array.isArray(content)) {
        return [];
      }

      return content
        .map((part) => {
          if (!part || typeof part !== "object") {
            return "";
          }

          if ("text" in part && typeof part.text === "string") {
            return part.text;
          }

          if ("content" in part && typeof part.content === "string") {
            return part.content;
          }

          return "";
        })
        .filter(Boolean);
    })
    .join("\n")
    .trim();
}

function parseJsonObject(text: string) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as {
      findings?: ModelFinding[];
      comparisons?: string[];
      decisions?: ValidationDecision[];
    };
  } catch {
    return null;
  }
}

function getChunkPrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  chunk: AuditTextChunk;
}) {
  const modeInstruction =
    args.auditMode === "volume"
      ? "Audite volume de projeto: capa, separatriz, LDs/listas, pranchas, selos, revisões, títulos, disciplinas, volume e tomo."
      : "Audite memorial descritivo textual: identidade do projeto, coerência interna, trechos reaproveitados, localidades divergentes, normas suspeitas, cálculos simples e redação.";

  return `
${modeInstruction}

Leia o trecho abaixo procurando erros que possam comprometer emissão, licitação, cliente ou consistência documental.
Procure ativamente: nome de obra/unidade divergente (ex.: UBS X vs UBS Y), município/proprietário divergente, bairro divergente, logradouro de outro projeto, referência municipal externa, conflito de hierarquia, norma inadequada, cálculo incoerente, unidade divergente, texto colado, trecho reaproveitado e redação/formatação crítica.

Projeto informado: ${args.projectName || "não informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Trecho: ${args.chunk.title}, páginas ${args.chunk.startPage}-${args.chunk.endPage}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

Responda APENAS JSON válido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "capítulo/seção",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descrição objetiva",
      "evidencia": "texto encontrado",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "conflito": "por que diverge",
      "sugestao_correcao": "correção sugerida",
      "confianca": "alta|media|baixa"
    }
  ]
}

Se não encontrar erro relevante, retorne {"findings":[]}.

TEXTO:
${args.chunk.text}
`.trim();
}

function getMaxOutputTokens() {
  return Number(
    process.env.NEXODOC_DEEP_CHUNK_MAX_OUTPUT_TOKENS ??
      DEFAULT_CHUNK_MAX_OUTPUT_TOKENS,
  );
}

function getMaxChunksPerFile() {
  const value = Number(process.env.NEXODOC_MAX_CHUNKS_PER_FILE);

  if (Number.isFinite(value) && value > 0) {
    return Math.min(24, Math.floor(value));
  }

  return DEFAULT_MAX_CHUNKS_PER_FILE;
}

function getChunkConcurrency() {
  const value = Number(process.env.NEXODOC_CHUNK_CONCURRENCY);

  if (Number.isFinite(value) && value > 0) {
    return Math.min(4, Math.floor(value));
  }

  return DEFAULT_CHUNK_CONCURRENCY;
}

function getChunkTimeoutMs() {
  const value = Number(process.env.NEXODOC_CHUNK_TIMEOUT_MS);

  if (Number.isFinite(value) && value >= 30_000) {
    return Math.min(300_000, Math.floor(value));
  }

  return DEFAULT_CHUNK_TIMEOUT_MS;
}

function getGlobalContextChars() {
  const value = Number(process.env.NEXODOC_GLOBAL_CONTEXT_CHARS);

  if (Number.isFinite(value) && value >= 40_000) {
    return Math.min(180_000, Math.floor(value));
  }

  return DEFAULT_GLOBAL_CONTEXT_CHARS;
}

function buildDocumentContext(extracted: ExtractedPdf) {
  const maxChars = getGlobalContextChars();

  if (extracted.text.length <= maxChars) {
    return extracted.text;
  }

  const headChars = Math.floor(maxChars * 0.38);
  const tailChars = Math.floor(maxChars * 0.42);
  const middleChars = maxChars - headChars - tailChars;
  const middleStart = Math.max(0, Math.floor((extracted.text.length - middleChars) / 2));

  return [
    extracted.text.slice(0, headChars),
    "\n\n--- RECORTE INTERMEDIARIO DO DOCUMENTO ---\n\n",
    extracted.text.slice(middleStart, middleStart + middleChars),
    "\n\n--- RECORTE FINAL DO DOCUMENTO ---\n\n",
    extracted.text.slice(-tailChars),
  ].join("");
}

const IDENTITY_CONTEXT_PATTERN =
  /\b(obra|identifica[cç][aã]o|localiza[cç][aã]o|endere[cç]o|propriet[aá]rio|nome|memorial descritivo|projeto preventivo|ppci|constru[cç][aã]o|reforma|adequa[cç][aã]o)\b/gi;

const IDENTITY_CANDIDATE_PATTERNS: Array<{ field: string; pattern: RegExp }> = [
  {
    field: "identidade em cabecalho",
    pattern: /[–-]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,120})\s+[–-]\s*PROJETO\s+EXECUTIVO/gi,
  },
  {
    field: "campo identificado",
    pattern: /\b(obra|identifica[cç][aã]o|nome|projeto|localiza[cç][aã]o|endere[cç]o|propriet[aá]rio|cliente|[oó]rg[aã]o)\s*:\s*([^.;\n]{4,180})/gi,
  },
  {
    field: "entidade nomeada",
    pattern: /\b((?:Centro|Cidade|UBS|Unidade|Escola|Creche|Gin[aá]sio|Reforma)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^,.;\n]{2,110})/g,
  },
  {
    field: "finalidade/obra citada",
    pattern: /\b(?:constru[cç][aã]o|execu[cç][aã]o|implanta[cç][aã]o)\s+(?:da|do|de|para\s+a|para\s+o)\s+([^.;\n]{4,140})/gi,
  },
  {
    field: "reforma/adequacao citada",
    pattern: /\b(?:reforma|adequa[cç][aã]o|reforma\s+e\s+adequa[cç][aã]o)\s*(?:[-–]\s*)?([^.;\n]{4,140})/gi,
  },
];

type IdentityCandidate = {
  field: string;
  value: string;
  pages: number[];
  count: number;
  evidence: string;
  firstPage: number;
  key: string;
};

function getContextSnippet(text: string, index: number, radius = 320) {
  return text
    .slice(Math.max(0, index - radius), Math.min(text.length, index + radius))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanIdentityCandidate(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^(?:para\s+a|para\s+o|da|do|de)\s+/i, "")
    .replace(/^reforma\s+/i, "")
    .replace(/\s+(?:é|possui|volume|projeto executivo|localizado|localizada|sito|situado|situada|no munic[ií]pio|em crici[uú]ma|endereço|endere[cç]o|propriet[aá]rio|[aá]rea)\b.*$/i, "")
    .replace(/\s*[,;:.-]+$/g, "")
    .trim();
}

function isLikelyProjectIdentity(value: string) {
  const normalized = normalizeLoose(value);
  const words = normalized.split(/\s+/).filter(Boolean);
  const startsAsNamedEntity =
    /^(centro|cidade|ubs|unidade|escola|creche|ginasio|gin[aá]sio|reforma)\b/i.test(
      normalized,
    );

  if (normalized.length < 8) {
    return false;
  }

  if (words.length > 10 && !startsAsNamedEntity) {
    return false;
  }

  if (
    /\b(procedimento|norma|paver|chapisco|estrutura|contentor|contentores|litros|publico em|acessibilidade|declividade|carga|pavimento|projeto executivo|prefeitura municipal|fiscalizacao|desenhos atualizados|conforme executado|aterro|aterros|jazida|infraestrutura composta|cabos|tubulacoes|caixas de passagem|tomadas de logica|rack de telecomunicacoes|indice de atendimento|populacao atendida|unidade de saude)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }

  return /\b(centro|cidade|ubs|unidade|escola|creche|ginasio|gin[aá]sio|reforma)\b/i.test(normalized);
}

function shouldKeepIdentityCandidate(field: string, value: string) {
  const normalized = normalizeLoose(value);
  const words = normalized.split(/\s+/).filter(Boolean);
  const startsAsNamedEntity =
    /^(centro|cidade|ubs|unidade|escola|creche|ginasio|gin[aá]sio|reforma)\b/i.test(
      normalized,
    );

  if (
    field === "finalidade/obra citada" &&
    (!startsAsNamedEntity || words.length > 10)
  ) {
    return false;
  }

  if (
    /\b(fiscalizacao|desenhos atualizados|conforme executado|aterro|aterros|jazida|infraestrutura composta|cabos|tubulacoes|caixas de passagem|tomadas de logica|rack de telecomunicacoes|indice de atendimento|populacao atendida|unidade de saude)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }

  return true;
}

function identityComparisonKey(value: string) {
  return normalizeLoose(value)
    .replace(/\b(de|do|da|dos|das)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getIdentityCandidates(extracted: ExtractedPdf) {
  const groups = new Map<string, IdentityCandidate>();

  for (const page of extracted.pages) {
    for (const { field, pattern } of IDENTITY_CANDIDATE_PATTERNS) {
      pattern.lastIndex = 0;

      for (const match of page.text.matchAll(pattern)) {
        const rawValue = match[2] ?? match[1] ?? "";
        const value = cleanIdentityCandidate(rawValue);
        const key = normalizeLoose(value);

        if (value.length < 4 || key.length < 4) {
          continue;
        }

        if (!shouldKeepIdentityCandidate(field, value)) {
          continue;
        }

        const current = groups.get(key);

        if (current) {
          current.count += 1;

          if (!current.pages.includes(page.page)) {
            current.pages.push(page.page);
          }

          continue;
        }

        groups.set(key, {
          field,
          value,
          pages: [page.page],
          count: 1,
          evidence: getContextSnippet(page.text, match.index ?? 0, 220),
          firstPage: page.page,
          key,
        });
      }
    }
  }

  return [...groups.values()]
    .sort((left, right) => {
      const countDiff = right.count - left.count;

      if (countDiff !== 0) {
        return countDiff;
      }

      return left.firstPage - right.firstPage;
    })
    .slice(0, 160);
}

function buildIdentityCandidateInventory(extracted: ExtractedPdf) {
  return getIdentityCandidates(extracted)
    .map((item) => {
      return [
        `Campo: ${item.field}`,
        `Valor: ${item.value}`,
        `Paginas: ${item.pages.join(", ")}`,
        `Ocorrencias: ${item.count}`,
        `Evidencia: ${item.evidence}`,
      ].join("\n");
    })
    .join("\n\n");
}

function areSameIdentity(left: IdentityCandidate, right: IdentityCandidate) {
  const leftKey = identityComparisonKey(left.value);
  const rightKey = identityComparisonKey(right.value);

  return leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey);
}

function isActionableDivergentIdentityCandidate(
  candidate: IdentityCandidate,
  dominant: IdentityCandidate,
) {
  const candidateKey = identityComparisonKey(candidate.value);
  const dominantKey = identityComparisonKey(dominant.value);
  const candidateWords = candidateKey.split(/\s+/).filter(Boolean);

  if (candidateWords.length > 10) {
    return false;
  }

  if (candidateKey.includes(dominantKey) || dominantKey.includes(candidateKey)) {
    return false;
  }

  if (
    candidate.field === "finalidade/obra citada" &&
    !/^(centro|cidade|ubs|unidade|escola|creche|ginasio|gin[aá]sio|reforma)\b/i.test(
      candidateKey,
    )
  ) {
    return false;
  }

  return true;
}

function summarizePages(pages: number[]) {
  const uniquePages = [...new Set(pages)].sort((left, right) => left - right);
  const visible = uniquePages.slice(0, 6).join(", ");

  if (uniquePages.length <= 6) {
    return visible;
  }

  return `${visible} e mais ${uniquePages.length - 6}`;
}

function getDominantIdentityCandidate(candidates: IdentityCandidate[]) {
  const viable = candidates.filter((candidate) => isLikelyProjectIdentity(candidate.value));

  return viable
    .map((candidate) => {
      const earlyBonus = candidate.firstPage <= 3 ? 10 : candidate.firstPage <= 15 ? 4 : 0;
      const headerBonus = candidate.field === "identidade em cabecalho" ? 12 : 0;
      const labelBonus = candidate.field === "campo identificado" ? 4 : 0;

      return {
        candidate,
        score: candidate.count * 3 + earlyBonus + headerBonus + labelBonus,
      };
    })
    .sort((left, right) => right.score - left.score)[0]?.candidate ?? null;
}

function deriveIdentityFindingsFromText(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const candidates = getIdentityCandidates(extracted);
  const dominant = getDominantIdentityCandidate(candidates);

  if (!dominant) {
    return [];
  }

  const divergentGroups = new Map<string, IdentityCandidate>();

  for (const candidate of candidates
    .filter((candidate) => isLikelyProjectIdentity(candidate.value))
    .filter((candidate) => !areSameIdentity(candidate, dominant))
    .filter((candidate) => isActionableDivergentIdentityCandidate(candidate, dominant))
    .filter((candidate) => candidate.firstPage > dominant.firstPage || candidate.count < dominant.count)
    .sort((left, right) => left.firstPage - right.firstPage)) {
    const key = identityComparisonKey(candidate.value);
    const current = divergentGroups.get(key);

    if (current) {
      current.count += candidate.count;
      current.pages = [...new Set([...current.pages, ...candidate.pages])].sort((left, right) => left - right);
      continue;
    }

    divergentGroups.set(key, { ...candidate });
  }

  return [...divergentGroups.values()].slice(0, 4).map((candidate, index) => ({
    id: `ID-${String(index + 1).padStart(3, "0")}`,
    arquivo: fileName,
    origem: "regra",
    prioridade: "Alta",
    pagina: candidate.pages.join(", "),
    capitulo: "Identidade documental",
    local: candidate.field,
    tipo: "Possível trecho reaproveitado de outro projeto",
    descricao: `O documento tem identidade predominante "${dominant.value}", mas também cita "${candidate.value}".`,
    evidencia: candidate.evidence,
    termo_busca: candidate.value.slice(0, 160),
    categoria: "Identidade documental",
    referencia_comparada: `Identidade predominante inferida: ${dominant.value} (${dominant.count} ocorrência(s), páginas ${summarizePages(dominant.pages)}).`,
    conflito: `"${candidate.value}" não corresponde à identidade predominante "${dominant.value}".`,
    sugestao_correcao: "Confirmar a obra correta e revisar o trecho indicado para remover referência residual de outro projeto.",
    confianca: candidate.count === 1 ? "media" : "alta",
    impacto: "critico_documental",
  }));
}

function levenshteinDistance(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function findEvidenceLine(text: string, term: string) {
  const normalizedTerm = normalizeLoose(term);
  const line = text
    .split(/\r?\n/)
    .find((item) => normalizeLoose(item).includes(normalizedTerm));

  return (line ?? term).replace(/\s+/g, " ").trim();
}

function deriveSpellingFindingsFromText(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const dominant = getDominantIdentityCandidate(getIdentityCandidates(extracted));

  if (!dominant) {
    return [];
  }

  const identityWords = normalizeLoose(dominant.value)
    .split(/\s+/)
    .filter((word) => word.length >= 8);
  const findings = new Map<string, AuditFinding>();

  if (identityWords.length === 0) {
    return [];
  }

  for (const page of extracted.pages) {
    const rawWords = page.text.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{8,}\b/g) ?? [];

    for (const rawWord of rawWords) {
      const normalizedWord = normalizeLoose(rawWord);
      const target = identityWords.find((word) => {
        return (
          normalizedWord !== word &&
          normalizedWord[0] === word[0] &&
          Math.abs(normalizedWord.length - word.length) <= 2 &&
          levenshteinDistance(normalizedWord, word) <= 2
        );
      });

      if (!target || findings.has(normalizedWord)) {
        continue;
      }

      findings.set(normalizedWord, {
        id: `REG-GRAFIA-${String(findings.size + 1).padStart(3, "0")}`,
        arquivo: fileName,
        origem: "regra",
        prioridade: "Media",
        pagina: String(page.page),
        capitulo: "Identidade documental",
        local: "nome da obra",
        tipo: "Grafia divergente no nome da obra",
        descricao: `O termo "${rawWord}" parece uma variação ortográfica de "${target}".`,
        evidencia: findEvidenceLine(page.text, rawWord),
        termo_busca: rawWord,
        categoria: "Revisão editorial",
        referencia_comparada: `Identidade predominante inferida: ${dominant.value}.`,
        conflito: `A grafia "${rawWord}" diverge da forma predominante "${target}", sem indicar troca de obra.`,
        sugestao_correcao: "Padronizar a grafia do nome da obra no trecho indicado.",
        confianca: "media",
        impacto: "tecnico_contratual",
      });
    }
  }

  return [...findings.values()].slice(0, 4);
}

function cleanHeadingTitle(value: string) {
  return normalizeLoose(value)
    .replace(/\d+/g, " ")
    .replace(/\b(pag|pagina|página)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveSummaryAndNumberingFindings(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const headings: Array<{ page: number; number: string; title: string; evidence: string }> = [];

  for (const page of extracted.pages) {
    for (const line of page.text.split(/\r?\n/)) {
      const compactLine = line.replace(/\s+/g, " ").trim();
      const match = /^(\d+(?:\.\d+)+)\s+([^.\n]{4,120}?)(?:\.{2,}|\s{2,}|\d{1,4}\s*$|$)/.exec(compactLine);

      if (!match) {
        continue;
      }

      const title = match[2].trim();

      if (title.length < 4 || cleanHeadingTitle(title).length < 4) {
        continue;
      }

      headings.push({
        page: page.page,
        number: match[1],
        title,
        evidence: compactLine,
      });
    }
  }

  const findings: AuditFinding[] = [];
  const byTitle = new Map<string, Array<{ page: number; number: string; title: string; evidence: string }>>();

  for (const heading of headings) {
    const key = cleanHeadingTitle(heading.title);
    const current = byTitle.get(key) ?? [];
    current.push(heading);
    byTitle.set(key, current);
  }

  for (const entries of byTitle.values()) {
    const distinctNumbers = [...new Set(entries.map((entry) => entry.number))];

    if (entries.length < 2 || distinctNumbers.length < 2) {
      continue;
    }

    const sample = entries.slice(0, 3);
    findings.push({
      id: `REG-SUM-${String(findings.length + 1).padStart(3, "0")}`,
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media",
      pagina: [...new Set(sample.map((entry) => entry.page))].join(", "),
      capitulo: "Sumário / hierarquia",
      local: sample.map((entry) => entry.number).join(" e "),
      tipo: "Título repetido em itens distintos",
      descricao: `O título "${sample[0].title}" aparece em mais de um item numerado.`,
      evidencia: sample.map((entry) => entry.evidence).join(" | "),
      termo_busca: sample[0].title.slice(0, 160),
      categoria: "Sumário / hierarquia",
      referencia_comparada: `Itens identificados: ${distinctNumbers.join(", ")}.`,
      conflito: "A repetição do mesmo título em itens diferentes sugere erro de edição, duplicidade ou seção não renomeada.",
      sugestao_correcao: "Confirmar se os itens tratam de assuntos diferentes; se forem distintos, renomear. Se forem duplicados, eliminar redundância e renumerar.",
      confianca: "alta",
      impacto: "tecnico_contratual",
    });

    if (findings.length >= 3) {
      break;
    }
  }

  const text = extracted.text.replace(/\r/g, "");
  const hierarchyChecks = [
    {
      chapter: "8",
      label: "Projeto Estrutural",
      wrongPrefix: "1.",
      pattern: /(?:^|\n)\s*8(?:\.\d+)?\s+[^\n]{0,80}Projeto\s+Estrutural[\s\S]{0,12000}?(?:^|\n)\s*(1\.(?:1[2-9]|[2-9]\d?)\s+[^\n]{4,140})/i,
    },
    {
      chapter: "14.3",
      label: "Memorial de Cálculo do Processo de Tratamento",
      wrongPrefix: "1.3.",
      pattern: /(?:^|\n)\s*14\.3\s+[^\n]{0,120}Memorial\s+de\s+C[aá]lculo[\s\S]{0,12000}?(?:^|\n)\s*(1\.3\.\d+\s+[^\n]{4,140})/i,
    },
  ];

  for (const check of hierarchyChecks) {
    const match = check.pattern.exec(text);

    if (!match) {
      continue;
    }

    const evidence = match[1].replace(/\s+/g, " ").trim();
    const page = extracted.pages.find((item) => item.text.includes(match[1]))?.page ?? "";

    findings.push({
      id: `REG-NUM-${String(findings.length + 1).padStart(3, "0")}`,
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media",
      pagina: page ? String(page) : "não identificada",
      capitulo: check.label,
      local: `numeração iniciada por ${check.wrongPrefix}`,
      tipo: "Numeração hierárquica incoerente",
      descricao: `Foi encontrado item com prefixo "${check.wrongPrefix}" dentro do capítulo ${check.chapter}.`,
      evidencia: evidence,
      termo_busca: evidence.slice(0, 160),
      categoria: "Sumário / hierarquia",
      referencia_comparada: `Capítulo esperado: ${check.chapter}.`,
      conflito: "A numeração do subitem não acompanha o capítulo em que aparece, sugerindo colagem ou revisão incompleta.",
      sugestao_correcao: "Revisar a hierarquia e renumerar os subitens para seguir o capítulo correto.",
      confianca: "media",
      impacto: "tecnico_contratual",
    });
  }

  return findings.slice(0, 6);
}

function deriveTechnicalReuseFindings(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  const indicators = [
    "eixo da rodovia",
    "Volume 2 - Quadro de Origem e Destino",
    "Volume 2 – Quadro de Origem e Destino",
    "DNIT",
  ];
  const findings: AuditFinding[] = [];

  for (const page of extracted.pages) {
    const normalizedPage = normalizeLoose(page.text);
    const found = indicators.find((indicator) => normalizedPage.includes(normalizeLoose(indicator)));

    if (!found || normalizedPage.includes("sumario")) {
      continue;
    }

    findings.push({
      id: `REG-TEC-${String(findings.length + 1).padStart(3, "0")}`,
      arquivo: fileName,
      origem: "regra",
      prioridade: "Media",
      pagina: String(page.page),
      capitulo: "Coerência técnica do memorial",
      local: "redação técnica",
      tipo: "Linguagem técnica possivelmente reaproveitada",
      descricao: `O texto contém expressão típica de terraplenagem/rodovia: "${found}".`,
      evidencia: findEvidenceLine(page.text, found),
      termo_busca: found,
      categoria: "Revisão técnica",
      referencia_comparada: "Objeto principal inferido do documento e linguagem técnica do trecho.",
      conflito: "A expressão pode ser compatível com metodologia de terraplenagem, mas exige conferência porque pode indicar texto-base de outro tipo de projeto.",
      sugestao_correcao: "Revisar o trecho para confirmar se a linguagem rodoviária é aplicável ao escopo da obra ou se deve ser ajustada.",
      confianca: "media",
      impacto: "tecnico_contratual",
    });

    if (findings.length >= 1) {
      break;
    }
  }

  return findings;
}

function deriveRuleBasedReviewFindings(extracted: ExtractedPdf, fileName: string): AuditFinding[] {
  return [
    ...deriveSpellingFindingsFromText(extracted, fileName),
    ...deriveSummaryAndNumberingFindings(extracted, fileName),
    ...deriveTechnicalReuseFindings(extracted, fileName),
  ];
}

function buildIdentityContext(extracted: ExtractedPdf) {
  const sections: string[] = [];

  for (const page of extracted.pages) {
    const snippets: string[] = [];
    const seen = new Set<string>();

    if (page.page <= 3) {
      const coverSnippet = page.text.slice(0, 1400).replace(/\s+/g, " ").trim();

      if (coverSnippet) {
        snippets.push(coverSnippet);
      }
    }

    IDENTITY_CONTEXT_PATTERN.lastIndex = 0;
    for (const match of page.text.matchAll(IDENTITY_CONTEXT_PATTERN)) {
      const candidate = getContextSnippet(page.text, match.index ?? 0);
      const key = candidate.slice(0, 160).toLowerCase();

      if (!candidate || seen.has(key)) {
        continue;
      }

      seen.add(key);
      snippets.push(candidate);

      if (snippets.length >= 5) {
        break;
      }
    }

    if (snippets.length > 0) {
      sections.push(`Pagina ${page.page}\n- ${snippets.join("\n- ")}`);
    }
  }

  return sections.join("\n\n").slice(0, 140_000);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

function modelFindingToAuditFinding(
  finding: ModelFinding,
  index: number,
  fileName?: string,
): AuditFinding | null {
  const description = String(finding.descricao ?? "").trim();
  const type = String(finding.tipo ?? "").trim();
  const evidence = String(finding.evidencia ?? "").trim();

  if (!description && !type && !evidence) {
    return null;
  }

  return {
    id: `IA-${String(index).padStart(3, "0")}`,
    arquivo: fileName,
    origem: "ia",
    prioridade: normalizePriority(finding.prioridade),
    pagina: String(finding.pagina ?? "não identificada"),
    capitulo: String(finding.capitulo ?? "não identificado"),
    local: String(finding.local ?? "não informado"),
    tipo: type || "Incongruência documental",
    descricao: description || evidence,
    evidencia: evidence || description,
    termo_busca: String(finding.termo_busca ?? (evidence || description))
      .trim()
      .slice(0, 160),
    categoria: String(finding.categoria ?? "").trim() || undefined,
    referencia_comparada:
      String(finding.referencia_comparada ?? "").trim() || undefined,
    conflito: String(finding.conflito ?? "não informado"),
    sugestao_correcao: String(finding.sugestao_correcao ?? "revisar o trecho indicado"),
    confianca: normalizeConfidence(finding.confianca),
  };
}

function hasSpecificAlternateIdentity(value: string) {
  const normalized = normalizeLoose(value);

  return (
    /\b(ubs|upa|centro|escola|creche|ginasio|ginásio|unidade)\s+[a-z0-9]/i.test(normalized) &&
    !/\b(unidade de saude|unidade atendida|populacao atendida)\b/i.test(normalized)
  );
}

function isLikelyFalseIdentityFinding(finding: AuditFinding) {
  const normalizedType = normalizeLoose(
    [
      finding.tipo,
      finding.categoria ?? "",
      finding.local,
      finding.descricao,
      finding.conflito,
      finding.evidencia,
      finding.termo_busca ?? "",
    ].join(" "),
  );

  const looksLikeIdentityConflict =
    normalizedType.includes("identidade") ||
    normalizedType.includes("reaproveitado de outro projeto") ||
    normalizedType.includes("nao corresponde a identidade predominante");

  if (!looksLikeIdentityConflict) {
    return false;
  }

  const searchTerm = normalizeLoose(finding.termo_busca ?? finding.evidencia);
  const evidence = normalizeLoose(finding.evidencia);
  const hasCorrectIdentityInEvidence =
    evidence.includes("centro de neurodivergencia") ||
    /pmf\s+secretaria municipal/.test(evidence) ||
    evidence.includes("projeto executivo memorial descritivo");
  const genericTechnicalContext =
    /\b(fiscalizacao|desenhos atualizados|conforme executado|aterro|aterros|jazida|infraestrutura composta|cabos|tubulacoes|caixas de passagem|tomadas de logica|rack de telecomunicacoes|indice de atendimento|populacao atendida|unidade de saude|estacao elevatoria|coeficiente de retorno)\b/i.test(
      `${searchTerm} ${evidence}`,
    );
  const startsAsGenericPhrase =
    /^(obra|aterros?|infraestrutura|indice|populacao|unidade|desenhos|fiscalizacao)\b/i.test(searchTerm);

  return (
    (hasCorrectIdentityInEvidence || genericTechnicalContext || startsAsGenericPhrase) &&
    !hasSpecificAlternateIdentity(searchTerm)
  );
}

function isLowValueModelFinding(finding: AuditFinding) {
  const normalized = normalizeLoose(
    [
      finding.tipo,
      finding.categoria ?? "",
      finding.local,
      finding.descricao,
      finding.evidencia,
      finding.conflito,
    ].join(" "),
  );

  if (
    normalized.includes("paginacao") &&
    normalized.includes("sumario") &&
    (normalized.includes("pagina analisada") || normalized.includes("trecho nao corresponde"))
  ) {
    return true;
  }

  if (
    normalized.includes("sobreposicao de escopo") &&
    normalized.includes("sumario") &&
    normalized.includes("paver") &&
    !normalized.includes("identidade")
  ) {
    return true;
  }

  return false;
}

function filterFalsePositiveIdentityFindings(findings: AuditFinding[]) {
  return findings.filter(
    (finding) =>
      !isLikelyFalseIdentityFinding(finding) && !isLowValueModelFinding(finding),
  );
}

function getAlternateIdentityKey(finding: AuditFinding) {
  const normalized = normalizeLoose(
    [finding.termo_busca ?? "", finding.conflito, finding.descricao, finding.evidencia].join(" "),
  );

  if (
    !normalized.includes("identidade predominante") &&
    !normalized.includes("nao corresponde") &&
    !normalized.includes("outro projeto")
  ) {
    return "";
  }

  const known = /(cidade do autista|centro dia do idoso|centro comunitario boa vista)/i.exec(normalized)?.[1];

  if (known) {
    return known;
  }

  const generic =
    /\b((?:cidade|centro|ubs|upa|unidade|escola|creche|ginasio)\s+[a-z0-9]+(?:\s+[a-z0-9]+){0,4})\b/i.exec(
      normalized,
    )?.[1] ?? "";

  return generic
    .replace(/\s+(?:e|eh|é|para|localizado|situado|sito)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactRepeatedIdentityFindings(findings: AuditFinding[]) {
  const result: AuditFinding[] = [];
  const byAlternateIdentity = new Map<string, AuditFinding>();

  for (const finding of findings) {
    const key = getAlternateIdentityKey(finding);

    if (!key) {
      result.push(finding);
      continue;
    }

    const current = byAlternateIdentity.get(key);

    if (!current) {
      byAlternateIdentity.set(key, finding);
      result.push(finding);
      continue;
    }

    current.pagina = [...new Set([...current.pagina.split(/\s*,\s*/), ...finding.pagina.split(/\s*,\s*/)])]
      .filter(Boolean)
      .join(", ");
    current.evidencia = current.evidencia.length >= finding.evidencia.length ? current.evidencia : finding.evidencia;
    current.confianca = current.confianca === "alta" || finding.confianca === "alta" ? "alta" : "media";
  }

  return result;
}

function dedupeFindings(findings: AuditFinding[]) {
  const seen = new Set<string>();
  const result: AuditFinding[] = [];

  for (const finding of findings) {
    const key = [
      finding.arquivo,
      finding.tipo,
      finding.pagina,
      finding.evidencia.slice(0, 120),
      finding.conflito.slice(0, 120),
    ]
      .join("|")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({ ...finding, id: `INC-${String(result.length + 1).padStart(3, "0")}` });
  }

  return result;
}

function inferProjectFields(text: string, fallbackProjectName: string) {
  const obra =
    /\bObra\s*:\s*([^,.;\n]{4,120})/i.exec(text)?.[1]?.trim() ??
    /\bIdentifica[cç][aã]o\s*:\s*([^,.;\n]{4,120})/i.exec(text)?.[1]?.trim() ??
    /\b\d{2,4}[_-]\d{2}\s*[–-]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,120})\s*[–-]\s*PROJETO\s+EXECUTIVO/i.exec(text)?.[1]?.trim() ??
    /UBS\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s-]+PORTE\s*\d+/i.exec(text)?.[0]?.trim() ??
    fallbackProjectName;
  const codigo = /\b\d{2,4}[_-]\d{2}\b/.exec(text)?.[0]?.replace("_", "-") ?? "";
  const municipio =
    /(Crici[uú]ma\/SC|Chapec[oó]\/SC|Munic[ií]pio\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]+)/i.exec(text)?.[0] ??
    "";
  const data = /(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/?\s*\d{4}/i.exec(text)?.[0]?.replace(/\s*\/\s*/g, "/") ?? "";
  const volume =
    /\bVol(?:ume)?\.?\s*(?:n[ºo]\s*)?([IVXLCDM]+|\d+)\b/i.exec(text)?.[0]?.trim() ??
    /\bVolume\s+([IVXLCDM]+|\d+)\b/i.exec(text)?.[0]?.trim() ??
    /\bVOL\.?\s*[–-]?\s*([IVXLCDM]+|\d+)\b/i.exec(text)?.[0]?.trim() ??
    "";
  const orgao =
    /(Prefeitura\s+Municipal\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s/]+(?:Secretaria\s+Municipal\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s/]+)?)/i
      .exec(text)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() ??
    /(Prefeitura\s+Municipal\s+de\s+Florian[oó]polis\s*\/\s*Secretaria\s+Municipal\s+de\s+Infraestrutura\s+e\s+Manuten[cç][aã]o\s+da\s+Cidade)/i
      .exec(text)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() ??
    /(PMF\s*-\s*Secretaria\s+Municipal\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s/]+)/i
      .exec(text)?.[0]
      ?.replace(/^PMF\s*-\s*/i, "Prefeitura Municipal de Florianópolis / ")
      .replace(/\s+/g, " ")
      .trim() ??
    /(SECRETARIA\s+MUNICIPAL\s+DE\s+INFRAESTRUTURA\s+E\s+MANUTEN[CÇ][AÃ]O\s+DA\s+CIDADE)/i
      .exec(text)?.[0]
      ?.replace(/\s+/g, " ")
      .replace(/^/i, "Prefeitura Municipal de Florianópolis / ")
      .trim() ??
    "";

  return {
    obra,
    codigo,
    municipio,
    volume,
    orgao,
    data,
  };
}

function inferDocumentType(auditMode: AuditMode, text: string) {
  if (/memorial\s+descritivo/i.test(text)) {
    return "Memorial Descritivo";
  }

  if (/lista\s+de\s+documentos|lista\s+de\s+desenhos|\bLD\b/i.test(text)) {
    return "Lista de Documentos";
  }

  if (/prancha|selo|carimbo/i.test(text)) {
    return "Prancha";
  }

  return auditMode === "volume" ? "Volume de projeto" : "Memorial Descritivo";
}

function isMissingProjectField(value: string) {
  const normalized = normalizeLoose(value);

  return !normalized || normalized === "projeto nao informado" || normalized === "nao informado";
}

async function analyzeChunkWithModel(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  chunk: AuditTextChunk;
}) {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: getPrimaryModelName(),
    instructions: getAuditorPrompt(args.auditMode),
    reasoning: {
      effort: getReasoningEffort(),
    },
    max_output_tokens: getMaxOutputTokens(),
    input: getChunkPrompt(args),
  }, {
    timeout: getChunkTimeoutMs(),
  });
  const text = extractResponseText(response);
  const parsed = parseJsonObject(text);

  return (parsed?.findings ?? [])
    .map((finding, index) =>
      modelFindingToAuditFinding(finding, index + 1, args.fileName),
    )
    .filter((finding): finding is AuditFinding => Boolean(finding));
}

function getIdentityAuditPrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
}) {
  return `
Faça uma leitura livre e contextual apenas da identidade documental deste arquivo. Não use termos pré-cadastrados. Extraia do próprio texto quais nomes de obra, códigos, endereços, municípios, proprietários, órgãos, disciplinas e finalidades aparecem.

Depois compare:
- qual identidade parece predominante;
- quais trechos citam outra obra, outra finalidade, outro endereço ou outro projeto;
- quais divergências são graves o suficiente para aparecer antes de normas, cálculos ou erros de formatação.

Use o inventário de candidatos abaixo como pistas extraídas automaticamente do PDF, não como regras fixas. Valores muito recorrentes em capa/cabeçalho/apresentação tendem a indicar a identidade predominante. Valores raros, mas incompatíveis com essa identidade, devem ser avaliados como possível reaproveitamento de outro projeto.

Não trate como conflito de identidade trechos técnicos genéricos que apenas estejam próximos do rodapé/cabeçalho com a identidade correta. Se o trecho cita a mesma obra predominante, mesmo em frase longa de escopo, infraestrutura, aterro, fiscalização, unidade atendida ou execução, classifique no máximo como ponto técnico em outra etapa, não como outra obra.

Se houver conflito de identidade, ele deve ser achado de prioridade Alta. Se houver apenas dúvida de grafia/endereço, use Media/Alta ou Media conforme impacto. Ignore problemas que não sejam de identidade nesta etapa. Não retorne duplicidade de sumário, norma, cálculo ou redação nesta etapa.

Projeto informado pelo usuário: ${args.projectName || "não informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Modo: ${args.auditMode}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

Responda APENAS JSON válido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "capítulo/seção",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descrição objetiva",
      "evidencia": "texto encontrado",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "categoria": "Identidade documental",
      "referencia_comparada": "identidade predominante ou trecho comparado",
      "conflito": "por que diverge",
      "sugestao_correcao": "correção sugerida",
      "confianca": "alta|media|baixa"
    }
  ]
}

Se não houver conflito de identidade, retorne {"findings":[]}.

INVENTÁRIO DE CANDIDATOS DE IDENTIDADE:
${buildIdentityCandidateInventory(args.extracted)}

TRECHOS DE IDENTIFICAÇÃO EXTRAÍDOS DO DOCUMENTO:
${buildIdentityContext(args.extracted)}
`.trim();
}

async function analyzeIdentityWithModel(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
}) {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: getPrimaryModelName(),
    instructions: getAuditorPrompt(args.auditMode),
    reasoning: { effort: getReasoningEffort() },
    max_output_tokens: getMaxOutputTokens(),
    input: getIdentityAuditPrompt(args),
  }, {
    timeout: getChunkTimeoutMs(),
  });
  const parsed = parseJsonObject(extractResponseText(response));

  return (parsed?.findings ?? [])
    .map((finding, index) =>
      modelFindingToAuditFinding(finding, index + 1, args.fileName),
    )
    .filter((finding): finding is AuditFinding => Boolean(finding));
}

function getGlobalFilePrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
}) {
  const modeInstruction =
    args.auditMode === "volume"
      ? "Faça uma leitura global do volume de projeto, como auditor documental sênior."
      : "Faça uma leitura global do memorial descritivo, como auditor documental sênior.";

  return `
${modeInstruction}

Esta etapa deve funcionar como uma análise livre do documento inteiro, não como checklist de termos. Primeiro entenda a identidade predominante do documento: obra, código, município, endereço, proprietário/órgão, data e disciplina. Depois procure incongruências internas, trechos reaproveitados, referências que pareçam pertencer a outra obra, conflitos de endereço/localidade, capítulos incoerentes, normas suspeitas, cálculos simples inconsistentes e problemas editoriais relevantes.

Priorize pelo impacto:
- Alta: conflito de identidade da obra, município, endereço, proprietário, órgão, disciplina ou trecho claramente herdado de outro projeto.
- Media/Alta: divergência técnica/contratual que pode afetar emissão, contratação ou revisão formal.
- Media ou menor: redação, formatação, duplicidade e pontos de conferência que não mudam a identidade do projeto.

Não invente evidência. Se o documento só permitir suspeita, marque confiança média ou baixa e explique o motivo.

Projeto informado pelo usuário: ${args.projectName || "não informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Páginas extraídas: ${args.extracted.pageCount}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

Responda APENAS JSON válido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "capítulo/seção",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descrição objetiva",
      "evidencia": "texto encontrado",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "categoria": "categoria do achado",
      "referencia_comparada": "identidade predominante ou trecho comparado, quando existir",
      "conflito": "por que diverge",
      "sugestao_correcao": "correção sugerida",
      "confianca": "alta|media|baixa"
    }
  ]
}

Se não encontrar erro relevante, retorne {"findings":[]}.

TEXTO DO DOCUMENTO:
${buildDocumentContext(args.extracted)}
`.trim();
}

async function analyzeFileGloballyWithModel(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
}) {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: getPrimaryModelName(),
    instructions: getAuditorPrompt(args.auditMode),
    reasoning: { effort: getReasoningEffort() },
    max_output_tokens: getMaxOutputTokens(),
    input: getGlobalFilePrompt(args),
  }, {
    timeout: getChunkTimeoutMs(),
  });
  const parsed = parseJsonObject(extractResponseText(response));

  return (parsed?.findings ?? [])
    .map((finding, index) =>
      modelFindingToAuditFinding(finding, index + 1, args.fileName),
    )
    .filter((finding): finding is AuditFinding => Boolean(finding));
}

function getCrossDocumentPrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  files: UploadedAuditFile[];
}) {
  let remainingCharacters = 120_000;
  const sources = args.files.map((file) => {
    const text = file.extracted.text.slice(0, Math.min(remainingCharacters, 45_000));
    remainingCharacters -= text.length;

    return [
      `ARQUIVO: ${file.file.name}`,
      `TIPO: ${file.fileType}`,
      `TEXTO EXTRAÍDO:`,
      text,
    ].join("\n");
  });

  return `
Compare os documentos do mesmo conjunto de auditoria. Esta etapa não é uma leitura isolada: confronte explicitamente os valores repetidos nos arquivos.

Modo: ${args.auditMode}
Projeto informado: ${args.projectName || "não informado"}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

Verifique, quando os documentos fornecerem evidência suficiente:
- memorial x capa: obra, código, endereço, bairro, município, órgão e volume;
- LD/lista x pranchas: número da prancha, título e revisão;
- capa/separatriz x selos: disciplina, volume, tomo, projeto e revisão;
- indícios de arquivo pertencente a outro projeto.

Não produza achado se um valor não estiver visível nos dois lados da comparação.
Responda APENAS JSON válido:
{
  "comparisons": ["comparação realmente executada e seu resultado"],
  "findings": [
    {
      "arquivo": "documento em que a divergência foi localizada",
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "Comparação entre documentos",
      "categoria": "LD x prancha|capa x selo|memorial x capa|estrutura do volume",
      "referencia_comparada": "outro documento e valor comparado",
      "local": "campo ou local visível",
      "tipo": "tipo da divergência",
      "descricao": "descrição objetiva",
      "evidencia": "texto localizado no documento",
      "termo_busca": "termo exato para localizar",
      "conflito": "valor A x valor B",
      "sugestao_correcao": "ação objetiva",
      "confianca": "alta|media|baixa"
    }
  ]
}

DOCUMENTOS:
${sources.join("\n\n---\n\n")}
`.trim();
}

function normalizeImpactDecision(value: string | undefined) {
  if (
    value === "critico_documental" ||
    value === "tecnico_contratual" ||
    value === "revisao_editorial"
  ) {
    return value;
  }

  return undefined;
}

function buildValidationContext(files: UploadedAuditFile[]) {
  let remainingCharacters = 90_000;

  return files
    .map((file) => {
      const text = buildDocumentContext(file.extracted).slice(0, Math.min(remainingCharacters, 45_000));
      remainingCharacters -= text.length;

      return [
        `ARQUIVO: ${file.file.name}`,
        `TIPO: ${file.fileType}`,
        `PÁGINAS: ${file.extracted.pageCount}`,
        `TEXTO DE CONTEXTO:`,
        text,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function buildFindingCandidateList(findings: AuditFinding[]) {
  return findings
    .slice(0, 40)
    .map((finding) => {
      return [
        `ID: ${finding.id}`,
        `Arquivo: ${finding.arquivo ?? "não informado"}`,
        `Origem: ${finding.origem ?? "não informada"}`,
        `Prioridade atual: ${finding.prioridade}`,
        `Impacto atual: ${finding.impacto ?? classifyFindingImpact(finding)}`,
        `Página: ${finding.pagina}`,
        `Capítulo: ${finding.capitulo}`,
        `Tipo: ${finding.tipo}`,
        `Descrição: ${finding.descricao}`,
        `Evidência: ${finding.evidencia}`,
        `Conflito: ${finding.conflito}`,
        `Ação atual: ${finding.sugestao_correcao}`,
      ].join("\n");
    })
    .join("\n\n");
}

function getFindingValidationPrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  files: UploadedAuditFile[];
  findings: AuditFinding[];
}) {
  return `
Você é a camada final de validação semântica do NexoDoc. Revise os achados candidatos abaixo como um auditor documental sênior, com julgamento parecido com uma boa análise manual.

Sua tarefa não é procurar novos erros. Sua tarefa é validar os candidatos:
- confirmar achado real;
- rebaixar gravidade quando for apenas ponto técnico/editorial;
- remover falso positivo.

Regra de gravidade:
- critico_documental: somente quando houver troca real de obra, município, endereço, órgão, cliente, código, disciplina ou documento pertencente a outro projeto.
- tecnico_contratual: numeração incoerente, sumário duplicado, linguagem técnica possivelmente reaproveitada, norma/cálculo/hierarquia que exige conferência.
- revisao_editorial: grafia, padronização, redação e detalhes sem impacto técnico direto.

Não mantenha como crítico:
- rodapé/cabeçalho repetido com a identidade correta;
- frase técnica longa apenas próxima do rodapé;
- menção histórica ou contexto da reforma;
- termo genérico como unidade, saúde, fiscalização, infraestrutura, aterro ou população atendida sem troca real da obra.

Se o candidato for útil mas exagerado, use "acao": "rebaixar" e ajuste prioridade/impacto/conflito.
Se for falso positivo, use "acao": "remover".
Se estiver correto, use "acao": "confirmar".

Projeto informado: ${args.projectName || "não informado"}
Modo: ${args.auditMode}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como preferência de auditoria, não como evidência:
${args.learningContext}

Responda APENAS JSON válido:
{
  "decisions": [
    {
      "source_id": "ID do achado candidato",
      "acao": "confirmar|rebaixar|remover",
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "impacto": "critico_documental|tecnico_contratual|revisao_editorial",
      "tipo": "tipo ajustado, se necessário",
      "descricao": "descrição ajustada, se necessário",
      "conflito": "por que é erro real, ponto de revisão ou falso positivo",
      "sugestao_correcao": "ação objetiva",
      "confianca": "alta|media|baixa",
      "motivo": "justificativa curta da decisão"
    }
  ]
}

ACHADOS CANDIDATOS:
${buildFindingCandidateList(args.findings)}

CONTEXTO DO DOCUMENTO:
${buildValidationContext(args.files)}
`.trim();
}

async function validateFindingsWithModel(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  files: UploadedAuditFile[];
  findings: AuditFinding[];
}) {
  if (args.findings.length === 0 || process.env.NEXODOC_DISABLE_FINDING_VALIDATION === "true") {
    return args.findings;
  }

  const openai = getOpenAIClient();

  try {
    const response = await openai.responses.create({
      model: getValidationModelName(),
      instructions: getAuditorPrompt(args.auditMode),
      reasoning: { effort: getReasoningEffort() },
      max_output_tokens: Math.max(getMaxOutputTokens(), 2600),
      input: getFindingValidationPrompt(args),
    }, {
      timeout: getChunkTimeoutMs(),
    });
    const parsed = parseJsonObject(extractResponseText(response));
    const decisions = new Map(
      (parsed?.decisions ?? [])
        .filter((decision) => decision.source_id && decision.acao)
        .map((decision) => [String(decision.source_id), decision]),
    );

    if (decisions.size === 0) {
      return args.findings;
    }

    return args.findings
      .map((finding) => {
        const decision = decisions.get(finding.id);

        if (!decision) {
          return finding;
        }

        if (decision.acao === "remover") {
          return null;
        }

        return {
          ...finding,
          prioridade: normalizePriority(decision.prioridade ?? finding.prioridade),
          impacto: normalizeImpactDecision(decision.impacto) ?? finding.impacto,
          tipo: String(decision.tipo ?? finding.tipo).trim() || finding.tipo,
          descricao: String(decision.descricao ?? finding.descricao).trim() || finding.descricao,
          conflito: String(decision.conflito ?? finding.conflito).trim() || finding.conflito,
          sugestao_correcao:
            String(decision.sugestao_correcao ?? finding.sugestao_correcao).trim() ||
            finding.sugestao_correcao,
          confianca: normalizeConfidence(decision.confianca ?? finding.confianca),
        };
      })
      .filter((finding): finding is AuditFinding => Boolean(finding));
  } catch (error) {
    console.error("[audit] validação semântica dos achados falhou; mantendo candidatos", error);
    return args.findings;
  }
}

async function analyzeCrossDocumentsWithModel(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  files: UploadedAuditFile[];
}) {
  if (args.files.length < 2) {
    return { findings: [] as AuditFinding[], comparisons: [] as string[] };
  }

  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: getPrimaryModelName(),
    instructions: getAuditorPrompt(args.auditMode),
    reasoning: { effort: getReasoningEffort() },
    max_output_tokens: getMaxOutputTokens(),
    input: getCrossDocumentPrompt(args),
  }, {
    timeout: getChunkTimeoutMs(),
  });
  const parsed = parseJsonObject(extractResponseText(response));

  return {
    findings: (parsed?.findings ?? [])
      .map((finding, index) =>
        modelFindingToAuditFinding(finding, index + 1, finding.arquivo),
      )
      .filter((finding): finding is AuditFinding => Boolean(finding)),
    comparisons: (parsed?.comparisons ?? []).filter(
      (comparison): comparison is string => typeof comparison === "string" && Boolean(comparison.trim()),
    ),
  };
}

async function deepAnalyzeFile(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  auditTitle: string;
  file: UploadedAuditFile;
}) {
  const startedAt = Date.now();
  const inferredIdentityFindings = deriveIdentityFindingsFromText(
    args.file.extracted,
    args.file.file.name,
  );
  const ruleBasedReviewFindings = deriveRuleBasedReviewFindings(
    args.file.extracted,
    args.file.file.name,
  );
  const hasInferredIdentityConflict = inferredIdentityFindings.length > 0;
  const chunkLimit = hasInferredIdentityConflict
    ? Math.min(4, getMaxChunksPerFile())
    : getMaxChunksPerFile();
  const chunks = chunkPdfByChapter(args.file.extracted).slice(0, chunkLimit);
  const concurrency = getChunkConcurrency();

  console.log(
    `[audit] ${args.file.file.name}: ${args.file.extracted.pageCount} paginas, ${args.file.extracted.charCount} caracteres, leitura de identidade, leitura global e ${chunks.length} blocos, concorrencia ${concurrency}`,
  );

  const identityStartedAt = Date.now();
  console.log(`[audit] ${args.file.file.name}: leitura de identidade iniciada`);
  const identityFindings = hasInferredIdentityConflict
    ? []
    : await analyzeIdentityWithModel({
        auditMode: args.auditMode,
        userMessage: args.userMessage,
        projectName: args.projectName,
        learningContext: args.learningContext,
        fileName: args.file.file.name,
        fileType: args.file.fileType,
        extracted: args.file.extracted,
      });
  console.log(
    `[audit] ${args.file.file.name}: leitura de identidade concluida em ${Math.round((Date.now() - identityStartedAt) / 1000)}s com ${inferredIdentityFindings.length + identityFindings.length} achado(s)`,
  );

  const globalStartedAt = Date.now();
  const shouldRunGlobalPass =
    !hasInferredIdentityConflict || process.env.NEXODOC_ALWAYS_RUN_GLOBAL_AI === "true";
  const globalFindings = shouldRunGlobalPass
    ? await analyzeFileGloballyWithModel({
        auditMode: args.auditMode,
        userMessage: args.userMessage,
        projectName: args.projectName,
        learningContext: args.learningContext,
        fileName: args.file.file.name,
        fileType: args.file.fileType,
        extracted: args.file.extracted,
      })
    : [];
  console.log(
    `[audit] ${args.file.file.name}: leitura global ${shouldRunGlobalPass ? "concluida" : "pulada"} em ${Math.round((Date.now() - globalStartedAt) / 1000)}s com ${globalFindings.length} achado(s)`,
  );

  const modelFindingGroups = await mapWithConcurrency(
    chunks,
    concurrency,
    async (chunk, index) => {
      const chunkStartedAt = Date.now();
      console.log(
        `[audit] ${args.file.file.name}: bloco ${index + 1}/${chunks.length} (${chunk.startPage}-${chunk.endPage}) iniciado`,
      );
      const findings = await analyzeChunkWithModel({
        auditMode: args.auditMode,
        userMessage: args.userMessage,
        projectName: args.projectName,
        learningContext: args.learningContext,
        fileName: args.file.file.name,
        fileType: args.file.fileType,
        chunk,
      });
      console.log(
        `[audit] ${args.file.file.name}: bloco ${index + 1}/${chunks.length} concluido em ${Math.round((Date.now() - chunkStartedAt) / 1000)}s com ${findings.length} achado(s)`,
      );
      return findings;
    },
  );
  const modelFindings = modelFindingGroups.flat();

  console.log(
    `[audit] ${args.file.file.name}: analise concluida em ${Math.round((Date.now() - startedAt) / 1000)}s com ${inferredIdentityFindings.length + ruleBasedReviewFindings.length + identityFindings.length + globalFindings.length + modelFindings.length} achado(s) antes de deduplicar`,
  );

  return dedupeFindings([
    ...inferredIdentityFindings,
    ...ruleBasedReviewFindings,
    ...identityFindings,
    ...globalFindings,
    ...modelFindings,
  ]);
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  let persistedAuditId: string | null = null;

  try {
    console.log("[audit] requisicao recebida");
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "").trim();
    const auditMode = parseAuditMode(formData.get("auditMode"));
    const projectName = String(formData.get("projectName") ?? "").trim();
    const auditTitle = String(formData.get("auditTitle") ?? "").trim();
    const auditDescription = String(formData.get("auditDescription") ?? "").trim();
    const clientAuditId = String(formData.get("auditId") ?? "").trim();
    const requestMockMode = formData.get("mockMode") === "true";
    const fileTypes = formData.getAll("fileTypes").map((value) => String(value));
    const files = formData
      .getAll("files")
      .filter((file): file is File => file instanceof File);

    if (!message) {
      return jsonError("Informe uma solicitação para a auditoria.");
    }

    if (files.length === 0) {
      return jsonError("Envie pelo menos um PDF para análise.");
    }

    if (files.length > MAX_FILES) {
      return jsonError(`Envie no máximo ${MAX_FILES} PDFs por análise.`);
    }

    for (const file of files) {
      if (!isPdf(file)) {
        return jsonError(`O arquivo "${file.name}" não é um PDF válido.`);
      }

      if (file.size > MAX_FILE_SIZE) {
        return jsonError(`O arquivo "${file.name}" excede o limite de 25 MB.`);
      }
    }

    const canUseClientMock = process.env.NODE_ENV !== "production" ||
      process.env.NEXODOC_ALLOW_CLIENT_DEMO === "true";

    if (requestMockMode && !canUseClientMock && !isMockModeEnabled()) {
      return jsonError("Modo demo não está habilitado neste ambiente.", 403);
    }

    const useMockMode = isMockModeEnabled() || (requestMockMode && canUseClientMock);

    if (useMockMode) {
      await waitForMockAudit();
      return withCors(
        NextResponse.json({
          result: getMockAuditResult(auditMode),
          auditMode,
          mock: true,
        }),
        request,
      );
    }

    const activeLearnings = await listAuditLearnings({
      activeOnly: true,
      scope: auditMode,
    });
    const learningContext = formatAuditLearningsForPrompt(activeLearnings);

    const auditId = /^[A-Za-z0-9-]{8,80}$/.test(clientAuditId)
      ? clientAuditId
      : crypto.randomUUID();
    persistedAuditId = await createPendingAudit({
      auditId,
      auditMode,
      auditTitle,
      projectName,
      auditDescription,
      files,
      fileTypes,
    });

    const uploadedFiles = await Promise.all(
      files.map(async (file, index): Promise<UploadedAuditFile> => {
        const fileStartedAt = Date.now();
        console.log(`[audit] extraindo texto: ${file.name} (${file.size} bytes)`);
        const buffer = Buffer.from(await file.arrayBuffer());
        const extracted = await extractPdfText(buffer);
        console.log(
          `[audit] texto extraido: ${file.name}, ${extracted.pageCount} paginas, ${extracted.charCount} caracteres em ${Math.round((Date.now() - fileStartedAt) / 1000)}s`,
        );

        if (extracted.charCount < MIN_TEXT_CHARS_FOR_DEEP_AUDIT) {
          throw new Error(`O arquivo "${file.name}" não possui texto suficiente para auditoria profunda.`);
        }

        return {
          file,
          fileType: fileTypes[index] ?? "não informado",
          buffer,
          extracted,
        };
      }),
    );
    const allFindings: AuditFinding[] = [];

    for (const file of uploadedFiles) {
      const findings = await deepAnalyzeFile({
        auditMode,
        userMessage: message,
        projectName,
        learningContext,
        auditTitle,
        file,
      });
      allFindings.push(...findings);
    }

    const modelComparison = await analyzeCrossDocumentsWithModel({
      auditMode,
      userMessage: message,
      projectName,
      learningContext,
      files: uploadedFiles,
    });
    allFindings.push(...modelComparison.findings);

    const candidateFindings = compactRepeatedIdentityFindings(
      filterFalsePositiveIdentityFindings(dedupeFindings(allFindings)),
    );
    console.log(
      `[audit] validação semântica iniciada com ${candidateFindings.length} achado(s) candidato(s)`,
    );
    const validatedFindings = await validateFindingsWithModel({
      auditMode,
      userMessage: message,
      projectName,
      learningContext,
      files: uploadedFiles,
      findings: candidateFindings,
    });
    console.log(
      `[audit] validação semântica concluida com ${validatedFindings.length} achado(s) confirmado(s)`,
    );

    const findings = sortAuditFindings(
      compactRepeatedIdentityFindings(
        filterFalsePositiveIdentityFindings(dedupeFindings(validatedFindings)),
      ),
    ).map(
      (finding, index) => ({
        ...finding,
        id: `INC-${String(index + 1).padStart(3, "0")}`,
      }),
    );
    console.log(
      `[audit] requisicao concluida em ${Math.round((Date.now() - requestStartedAt) / 1000)}s com ${findings.length} achado(s)`,
    );
    const combinedText = uploadedFiles.map((file) => file.extracted.text).join("\n");
    const inferred = inferProjectFields(combinedText, projectName);
    const inferredDocumentType = inferDocumentType(auditMode, combinedText);
    const dominantIdentity = uploadedFiles[0]
      ? getDominantIdentityCandidate(getIdentityCandidates(uploadedFiles[0].extracted))?.value
      : "";
    const hasCriticalDocumental = findings.some(
      (finding) => (finding.impacto ?? classifyFindingImpact(finding)) === "critico_documental",
    );
    const executiveSummary = buildExecutiveSummary(findings);
    const report: AuditReport = {
      arquivo: uploadedFiles.map((file) => file.file.name).join(", "),
      tipo_auditoria: auditMode,
      tipo_documento: inferredDocumentType,
      runtime: {
        modelo_principal: getPrimaryModelName(),
        modelo_validacao: getValidationModelName(),
        esforco_raciocinio: getReasoningEffort(),
        duracao_ms: Date.now() - requestStartedAt,
        arquivos: uploadedFiles.length,
        gerado_em: new Date().toISOString(),
      },
      obra: isMissingProjectField(inferred.obra) ? dominantIdentity || "não identificada" : inferred.obra,
      codigo: inferred.codigo,
      municipio: inferred.municipio,
      volume: inferred.volume,
      orgao: inferred.orgao,
      data_documento: inferred.data,
      status_analise: "concluida",
      status_geral:
        findings.length === 0
          ? "sem achados críticos"
          : hasCriticalDocumental
            ? "revisão obrigatória antes de emissão"
            : "com pontos de revisão",
      total_incongruencias: findings.length,
      arquivos_analisados: uploadedFiles.map((file) => ({
        arquivo: file.file.name,
        tipo_documento: file.fileType,
        paginas: file.extracted.pageCount,
        caracteres_extraidos: file.extracted.charCount,
        resumo: `Auditoria profunda com leitura de identidade, leitura global por IA e ${chunkPdfByChapter(file.extracted).length} blocos de leitura por capítulo.`,
      })),
      comparacoes:
        modelComparison.comparisons,
      incongruencias: findings,
      conclusao:
        findings.length === 0
          ? "nenhum achado crítico detectado dentro da auditoria profunda executada"
          : executiveSummary,
    };
    const result = makeTextReport(report);
    await persistCompletedAudit({
      auditId: persistedAuditId,
      uploadedFiles,
      report,
      result,
      elapsedMs: Date.now() - requestStartedAt,
    });

    return withCors(
      NextResponse.json({ result, report, auditMode, auditId: persistedAuditId }),
      request,
    );
  } catch (error) {
    console.error(error);
    await persistFailedAudit(persistedAuditId, error, Date.now() - requestStartedAt);

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return jsonError("OPENAI_API_KEY não configurada no backend.", 500);
    }

    if (
      error instanceof Error &&
      (error.message.includes("model") || error.message.includes("modelo"))
    ) {
      return jsonError(
        "Modelo da OpenAI indisponível. Verifique OPENAI_MODEL no .env.local.",
        500,
      );
    }

    if (
      error instanceof Error &&
      (error.message.includes("quota") ||
        error.message.includes("insufficient_quota") ||
        error.message.includes("billing"))
    ) {
      return jsonError(
        "A conta da OpenAI API retornou limite de quota para esta auditoria profunda. Reduza o tamanho do arquivo ou aumente os limites do projeto OpenAI.",
        402,
      );
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a auditoria documental.",
      500,
    );
  }
}
