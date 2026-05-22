import { NextResponse } from "next/server";

import { parseAuditMode, type AuditMode } from "@/lib/audit-mode";
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
import { runDeterministicAuditRules } from "@/lib/audit-rules";
import { getAuditorPrompt } from "@/lib/auditor-prompt";
import { isDatabaseConfigured, prisma } from "@/lib/db";
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
const DEFAULT_MAX_CHUNKS_PER_FILE = 24;
const DEFAULT_CHUNK_CONCURRENCY = 5;
const DEFAULT_CHUNK_TIMEOUT_MS = 120_000;

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

async function persistCompletedAudit(args: {
  auditMode: AuditMode;
  auditTitle: string;
  projectName: string;
  auditDescription: string;
  uploadedFiles: UploadedAuditFile[];
  report: AuditReport;
  result: string;
  elapsedMs: number;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  try {
    await prisma.audit.create({
      data: {
        title: args.auditTitle || "Auditoria sem identificacao",
        projectName: args.projectName || "Projeto nao informado",
        description: args.auditDescription,
        auditMode: args.auditMode,
        status: "COMPLETED",
        result: args.result,
        report: args.report,
        elapsedMs: args.elapsedMs,
        totalFindings: args.report.total_incongruencias,
        completedAt: new Date(),
        files: {
          create: args.uploadedFiles.map((file) => ({
            fileName: file.file.name,
            documentType: file.fileType,
            pageCount: file.extracted.pageCount,
            extractedCharCount: file.extracted.charCount,
            sizeBytes: file.file.size,
          })),
        },
      },
    });
  } catch (error) {
    console.error("[audit] falha ao persistir auditoria", error);
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
  conflito?: string;
  sugestao_correcao?: string;
  confianca?: string;
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
    return JSON.parse(candidate.slice(start, end + 1)) as { findings?: ModelFinding[] };
  } catch {
    return null;
  }
}

function getChunkPrompt(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  fileName: string;
  fileType: string;
  chunk: AuditTextChunk;
}) {
  const modeInstruction =
    args.auditMode === "volume"
      ? "Audite volume de projeto: capa, separatriz, LDs/listas, pranchas, selos, revisoes, titulos, disciplinas, volume e tomo."
      : "Audite memorial descritivo textual: identidade do projeto, coerencia interna, trechos reaproveitados, localidades divergentes, normas suspeitas, calculos simples e redacao.";

  return `
${modeInstruction}

Leia o trecho abaixo procurando erros que possam comprometer emissao, licitacao, cliente ou consistencia documental.
Procure ativamente: nome de obra/unidade divergente (ex.: UBS X vs UBS Y), municipio/proprietario divergente, bairro divergente, logradouro de outro projeto, referencia municipal externa, conflito de hierarquia, norma inadequada, calculo incoerente, unidade divergente, texto colado, trecho reaproveitado e redacao/formatação critica.

Projeto informado: ${args.projectName || "nao informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Trecho: ${args.chunk.title}, paginas ${args.chunk.startPage}-${args.chunk.endPage}
Solicitacao do usuario: ${args.userMessage}

Responda APENAS JSON valido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "numero ou intervalo",
      "capitulo": "capitulo/secao",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descricao objetiva",
      "evidencia": "texto encontrado",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "conflito": "por que diverge",
      "sugestao_correcao": "correcao sugerida",
      "confianca": "alta|media|baixa"
    }
  ]
}

Se nao encontrar erro relevante, retorne {"findings":[]}.

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
    return Math.min(48, Math.floor(value));
  }

  return DEFAULT_MAX_CHUNKS_PER_FILE;
}

function getChunkConcurrency() {
  const value = Number(process.env.NEXODOC_CHUNK_CONCURRENCY);

  if (Number.isFinite(value) && value > 0) {
    return Math.min(6, Math.floor(value));
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
    pagina: String(finding.pagina ?? "nao identificada"),
    capitulo: String(finding.capitulo ?? "nao identificado"),
    local: String(finding.local ?? "nao informado"),
    tipo: type || "Incongruencia documental",
    descricao: description || evidence,
    evidencia: evidence || description,
    termo_busca: String(finding.termo_busca ?? (evidence || description))
      .trim()
      .slice(0, 160),
    conflito: String(finding.conflito ?? "nao informado"),
    sugestao_correcao: String(finding.sugestao_correcao ?? "revisar o trecho indicado"),
    confianca: normalizeConfidence(finding.confianca),
  };
}

function dedupeFindings(findings: AuditFinding[]) {
  const seen = new Set<string>();
  const result: AuditFinding[] = [];

  for (const finding of findings) {
    const key = [
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
    /UBS\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s-]+PORTE\s*\d+/i.exec(text)?.[0]?.trim() ??
    fallbackProjectName;
  const codigo = /\b\d{2,4}[_-]\d{2}\b/.exec(text)?.[0]?.replace("_", "-") ?? "";
  const municipio =
    /(Crici[uú]ma\/SC|Chapec[oó]\/SC|Munic[ií]pio\s+de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]+)/i.exec(text)?.[0] ??
    "";
  const data = /(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/?\d{4}/i.exec(text)?.[0] ?? "";

  return {
    obra,
    codigo,
    municipio,
    data,
  };
}

async function analyzeChunkWithModel(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  fileName: string;
  fileType: string;
  chunk: AuditTextChunk;
}) {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
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

async function deepAnalyzeFile(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  auditTitle: string;
  file: UploadedAuditFile;
}) {
  const startedAt = Date.now();
  const deterministicFindings = runDeterministicAuditRules({
    fileName: args.file.file.name,
    projectName: args.projectName,
    extracted: args.file.extracted,
  }).map((finding) => ({
    ...finding,
    arquivo: finding.arquivo ?? args.file.file.name,
    termo_busca: finding.termo_busca ?? finding.evidencia.slice(0, 160),
  }));
  const chunks = chunkPdfByChapter(args.file.extracted).slice(0, getMaxChunksPerFile());
  const concurrency = getChunkConcurrency();

  console.log(
    `[audit] ${args.file.file.name}: ${args.file.extracted.pageCount} paginas, ${args.file.extracted.charCount} caracteres, ${chunks.length} blocos, concorrencia ${concurrency}, ${deterministicFindings.length} achado(s) por regra`,
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
    `[audit] ${args.file.file.name}: analise concluida em ${Math.round((Date.now() - startedAt) / 1000)}s com ${deterministicFindings.length + modelFindings.length} achado(s) antes de deduplicar`,
  );

  return dedupeFindings([...deterministicFindings, ...modelFindings]);
}

export async function POST(request: Request) {
  try {
    const requestStartedAt = Date.now();
    console.log("[audit] requisicao recebida");
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "").trim();
    const auditMode = parseAuditMode(formData.get("auditMode"));
    const projectName = String(formData.get("projectName") ?? "").trim();
    const auditTitle = String(formData.get("auditTitle") ?? "").trim();
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

    if (isMockModeEnabled()) {
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
          throw new Error(`O arquivo "${file.name}" nao possui texto suficiente para auditoria profunda.`);
        }

        return {
          file,
          fileType: fileTypes[index] ?? "nao informado",
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
        auditTitle,
        file,
      });
      allFindings.push(...findings);
    }

    const findings = sortAuditFindings(dedupeFindings(allFindings)).map(
      (finding, index) => ({
        ...finding,
        id: `INC-${String(index + 1).padStart(3, "0")}`,
      }),
    );
    console.log(
      `[audit] requisicao concluida em ${Math.round((Date.now() - requestStartedAt) / 1000)}s com ${findings.length} achado(s)`,
    );
    const combinedText = uploadedFiles.map((file) => file.extracted.text.slice(0, 20000)).join("\n");
    const inferred = inferProjectFields(combinedText, projectName);
    const hasCriticalDocumental = findings.some(
      (finding) => classifyFindingImpact(finding) === "critico_documental",
    );
    const hasHigh = findings.some((finding) => finding.prioridade === "Alta" || finding.prioridade === "Media/Alta");
    const executiveSummary = buildExecutiveSummary(findings);
    const report: AuditReport = {
      arquivo: uploadedFiles.map((file) => file.file.name).join(", "),
      tipo_auditoria: auditMode,
      tipo_documento: auditMode === "volume" ? "Volume de projeto" : "Memorial Descritivo",
      obra: inferred.obra || projectName || "nao identificada",
      codigo: inferred.codigo,
      municipio: inferred.municipio,
      data_documento: inferred.data,
      status_analise: "concluida",
      status_geral:
        findings.length === 0
          ? "sem achados criticos"
          : hasCriticalDocumental
            ? "revisao obrigatoria antes de emissao"
            : hasHigh
            ? "com inconsistencias criticas"
            : "com pontos de revisao",
      total_incongruencias: findings.length,
      arquivos_analisados: uploadedFiles.map((file) => ({
        arquivo: file.file.name,
        tipo_documento: file.fileType,
        paginas: file.extracted.pageCount,
        caracteres_extraidos: file.extracted.charCount,
        resumo: `Auditoria profunda com texto extraido por pagina, ${chunkPdfByChapter(file.extracted).length} blocos de leitura e checklist deterministico.`,
      })),
      comparacoes:
        auditMode === "volume"
          ? ["Analise focada em LD x pranchas, selos, revisoes, titulos e estrutura do volume."]
          : ["Analise focada em coerencia interna do memorial, reaproveitamento de texto, localidades, normas e calculos simples."],
      incongruencias: findings,
      conclusao:
        findings.length === 0
          ? "nenhum achado critico detectado dentro da auditoria profunda executada"
          : executiveSummary,
    };
    const result = makeTextReport(report);
    await persistCompletedAudit({
      auditMode,
      auditTitle,
      projectName,
      auditDescription: String(formData.get("auditDescription") ?? "").trim(),
      uploadedFiles,
      report,
      result,
      elapsedMs: Date.now() - requestStartedAt,
    });

    return withCors(NextResponse.json({ result, report, auditMode }), request);
  } catch (error) {
    console.error(error);

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
