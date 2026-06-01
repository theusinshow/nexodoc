import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordAiUsage } from "@/lib/ai-usage";
import {
  classifyProviderFailure,
  createInvalidProviderResponseError,
  getAiConfiguration,
  getMimoApiKey,
  recordProviderFailure,
  type SafeProviderFailure,
} from "@/lib/ai-providers";
import { getOpenAIClient } from "@/lib/openai";

type StampExtraction = {
  disciplina: string | null;
  folha: number | null;
  total: number | null;
  numeroFolha: string | null;
  arquivo: string | null;
  conteudo: string | null;
  cliente: string | null;
  obra: string | null;
  fase: string | null;
  tituloSecao: string | null;
  confianca: "alta" | "media" | "baixa";
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    disciplina: {
      type: ["string", "null"],
      description: "Sigla real da disciplina lida no campo PRANCHA, quando existir. Nunca use rótulos do carimbo como IMP, DATA, ESCALA ou REV.",
    },
    folha: {
      type: ["number", "null"],
      description: "Número da folha lido no campo PRANCHA.",
    },
    total: {
      type: ["number", "null"],
      description: "Total de folhas lido no campo PRANCHA.",
    },
    numeroFolha: {
      type: ["string", "null"],
      description: "Valor completo de PRANCHA no formato NN/TT, se encontrado.",
    },
    arquivo: {
      type: ["string", "null"],
      description: "Valor exato do campo ARQUIVO.",
    },
    conteudo: {
      type: ["string", "null"],
      description: "Valor exato somente do campo CONTEÚDO/DESCRIÇÃO, sem rótulos vizinhos como IMP, DATA, ESCALA, REV ou PRANCHA.",
    },
    cliente: {
      type: ["string", "null"],
      description: "Órgão/cliente lido no cabeçalho ou rodapé da página, como PREFEITURA MUNICIPAL DE CRICIÚMA.",
    },
    obra: {
      type: ["string", "null"],
      description: "Nome da obra/projeto lido no cabeçalho ou rodapé da página.",
    },
    fase: {
      type: ["string", "null"],
      description: "Fase do projeto lida no cabeçalho ou rodapé, como PROJETO EXECUTIVO.",
    },
    tituloSecao: {
      type: ["string", "null"],
      description: "Título técnico da seção ou disciplina da LD, como PROJETO ESTRUTURAL CONCRETO.",
    },
    confianca: {
      type: "string",
      enum: ["alta", "media", "baixa"],
      description: "Confiança da extração visual.",
    },
  },
  required: [
    "disciplina",
    "folha",
    "total",
    "numeroFolha",
    "arquivo",
    "conteudo",
    "cliente",
    "obra",
    "fase",
    "tituloSecao",
    "confianca",
  ],
} as const;

const systemPrompt = `Leia a primeira prancha técnica para montar uma Lista de Documentos.

Extraia do selo da prancha:
- PRANCHA
- ARQUIVO
- CONTEÚDO

Extraia também do cabeçalho ou rodapé da página, quando visível ou presente no texto extraído:
- Órgão/cliente
- Nome da obra/projeto
- Fase do projeto
- Título técnico da seção/disciplina da LD

O campo PRANCHA sempre existe no selo.
O campo ARQUIVO sempre existe no selo.
O campo CONTEÚDO sempre existe no selo.

Para cliente, obra, fase e título da seção, use apenas texto presente na página.
Não reescreva textos.
Não corrija ortografia.
Não resuma.
Não complete informação ausente.
Copie o campo CONTEÚDO exatamente como aparece, exceto por juntar quebras de linha.
O campo CONTEÚDO/DESCRIÇÃO deve conter apenas a descrição técnica da prancha.
Não inclua rótulos ou valores de campos vizinhos do carimbo no CONTEÚDO, como IMP, DATA, ESCALA, REV, REVISÃO, VISTO, DESENHO, FOLHA, PRANCHA, ARQUIVO, RESPONSÁVEL ou CLIENTE.
Se o texto visual estiver próximo desses campos, pare o CONTEÚDO antes do primeiro rótulo vizinho.
Para disciplina, use somente siglas reais de disciplina/projeto. Se a leitura sugerir IMP, DATA, ESCALA, REV, VISTO, ARQUIVO ou outro rótulo do carimbo, retorne disciplina como null.

Responda apenas em JSON.
Se algum campo não for encontrado, use null.`;

function isValidImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(value);
}

function isValidPdfText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 60000;
}

type ProviderError = {
  status?: number;
  code?: string;
  type?: string;
  message?: string;
};

type ExtractionMetadata = {
  taskId?: string;
  taskLabel?: string;
  operation?: string;
  fileName?: string;
  pageNumber?: number;
  cropMode?: string;
  source?: "text" | "visual";
};

const CONTENT_FIELD_STOP_LABELS = [
  "IMP",
  "DATA",
  "ESCALA",
  "REV",
  "REVISÃO",
  "REVISAO",
  "VISTO",
  "DESENHO",
  "FOLHA",
  "N° DA FOLHA",
  "Nº DA FOLHA",
  "N DA FOLHA",
  "PRANCHA",
  "ARQUIVO",
  "RESPONSÁVEL",
  "RESPONSAVEL",
  "CLIENTE",
  "OBRA",
  "FASE",
  "DISCIPLINA",
];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanExtractedContentField(value: string | null) {
  if (!value) {
    return value;
  }

  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:CONTE[ÚU]DO|DESCRI[ÇC][ÃA]O)\s*[:\-]?\s*/i, "")
    .trim();
  const stopPattern = CONTENT_FIELD_STOP_LABELS.map(escapeRegex).join("|");
  const stopMatch = new RegExp(`\\s(?:${stopPattern})\\s*[:\\-]?`, "i").exec(normalized);
  const cleaned = (stopMatch ? normalized.slice(0, stopMatch.index) : normalized)
    .replace(/\s*[,;:\-–—]+\s*$/g, "")
    .trim();

  return cleaned || null;
}

function sanitizeStampExtraction(extraction: StampExtraction): StampExtraction {
  const normalizedDiscipline = extraction.disciplina
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const disciplina =
    normalizedDiscipline &&
    ["imp", "data", "escala", "rev", "revisao", "visto", "arquivo", "prancha", "folha"].includes(
      normalizedDiscipline,
    )
      ? null
      : extraction.disciplina;

  return {
    ...extraction,
    disciplina,
    conteudo: cleanExtractedContentField(extraction.conteudo),
  };
}

function buildTextPrompt(pdfText?: string) {
  if (!pdfText) {
    return systemPrompt;
  }

  return `${systemPrompt}

O conteúdo abaixo foi extraído do PDF e pode estar fora de ordem por causa da diagramação.
Identifique os valores associados aos rótulos do selo sem usar o nome do arquivo enviado.
Para cliente, obra, fase e título da seção, procure também no cabeçalho, rodapé e linhas com LISTA DE DOCUMENTOS.

TEXTO EXTRAÍDO:
${pdfText}`;
}

async function extractWithOpenAi(model: string, textPrompt: string, imageDataUrl?: string) {
  const client = getOpenAIClient();
  const inputContent = [
    {
      type: "input_text" as const,
      text: textPrompt,
    },
    ...(imageDataUrl
      ? [{
          type: "input_image" as const,
          image_url: imageDataUrl,
          detail: "high" as const,
        }]
      : []),
  ];

  const response = await client.responses.create({
    model,
    max_output_tokens: 8000,
    reasoning: {
      effort: "none",
    },
    input: [
      {
        role: "user",
        content: inputContent,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ld_stamp_extraction",
        strict: true,
        schema: extractionSchema,
      },
    },
  });

  try {
    return {
      parsed: sanitizeStampExtraction(JSON.parse(response.output_text) as StampExtraction),
      response,
    };
  } catch {
    throw createInvalidProviderResponseError();
  }
}

function parseMimoOutput(content: string | null | undefined) {
  const json = content?.match(/\{[\s\S]*\}/)?.[0];

  if (!json) {
    throw createInvalidProviderResponseError();
  }

  try {
    return JSON.parse(json) as StampExtraction;
  } catch {
    throw createInvalidProviderResponseError();
  }
}

async function extractWithMimo(model: string, textPrompt: string, imageDataUrl?: string) {
  const apiKey = getMimoApiKey();

  if (!apiKey) {
    throw new Error("MIMO_API_KEY não configurada no backend.");
  }

  const response = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 1024,
      thinking: { type: "disabled" },
      messages: [
        {
          role: "user",
          content: [
            ...(imageDataUrl
              ? [{
                  type: "image_url",
                  image_url: { url: imageDataUrl },
                }]
              : []),
            {
              type: "text",
              text: `${textPrompt}

Retorne estritamente um objeto JSON com as chaves disciplina, folha, total, numeroFolha, arquivo, conteudo, cliente, obra, fase, tituloSecao e confianca. Para campos não encontrados use null. Para confianca use "alta", "media" ou "baixa".`,
            },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: string } | string;
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  if (!response.ok) {
    const providerMessage =
      typeof payload?.error === "string" ? payload.error : payload?.error?.message;
    const providerError = new Error(providerMessage ?? "Falha ao chamar o fallback MiMo.") as Error & ProviderError;
    providerError.status = response.status;
    providerError.code = typeof payload?.error === "object" ? payload.error.code : undefined;
    throw providerError;
  }

  return {
    parsed: sanitizeStampExtraction(parseMimoOutput(payload?.choices?.[0]?.message?.content)),
    payload,
  };
}

function getFailureStatus(failure: SafeProviderFailure) {
  switch (failure.category) {
    case "authentication":
      return 401;
    case "quota_billing":
      return 402;
    case "rate_limit":
      return 429;
    case "timeout":
      return 504;
    case "invalid_response":
      return 502;
    default:
      return 503;
  }
}

function asAttempt(failure: SafeProviderFailure) {
  return {
    provider: failure.provider,
    model: failure.model,
    status: "failed" as const,
    category: failure.category,
    message: failure.message,
  };
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const body = (await request.json()) as {
    imageDataUrl?: unknown;
    pdfText?: unknown;
    metadata?: ExtractionMetadata;
  };
  const imageDataUrl = isValidImageDataUrl(body.imageDataUrl) ? body.imageDataUrl : undefined;
  const pdfText = isValidPdfText(body.pdfText) ? body.pdfText : undefined;
  const metadata = body.metadata ?? {};
  const operation =
    metadata.operation ??
    (imageDataUrl ? "ld-stamp-visual-extraction" : "ld-stamp-text-extraction");

  if (!imageDataUrl && !pdfText) {
    return NextResponse.json(
      { error: "Texto ou imagem do selo inválidos ou ausentes." },
      { status: 400 },
    );
  }

  const textPrompt = buildTextPrompt(pdfText);
  const configuration = getAiConfiguration().ldExtraction;
  let openAiFailure: SafeProviderFailure;

  try {
    const startedAt = Date.now();
    const { parsed, response } = await extractWithOpenAi(
      configuration.primary.model,
      textPrompt,
      imageDataUrl,
    );
    await recordAiUsage({
      flow: "ld-extraction",
      taskId: metadata.taskId,
      taskLabel: metadata.taskLabel,
      provider: "openai",
      model: configuration.primary.model,
      operation,
      response,
      durationMs: Date.now() - startedAt,
      userEmail: session.user.email,
      metadata: {
        fileName: metadata.fileName,
        pageNumber: metadata.pageNumber,
        cropMode: metadata.cropMode,
        source: metadata.source ?? (imageDataUrl ? "visual" : "text"),
        hasImage: Boolean(imageDataUrl),
        pdfTextChars: pdfText?.length ?? 0,
      },
    });

    return NextResponse.json({
      ...parsed,
      provider: "openai",
      attempts: [{
        provider: "openai",
        model: configuration.primary.model,
        status: "succeeded",
      }],
    });
  } catch (error) {
    openAiFailure = classifyProviderFailure(
      "openai",
      "ld-extraction",
      configuration.primary.model,
      error,
    );
    recordProviderFailure(openAiFailure);
  }

  if (configuration.fallback.keyConfigured) {
    try {
      const startedAt = Date.now();
      const { parsed, payload } = await extractWithMimo(
        configuration.fallback.model,
        textPrompt,
        imageDataUrl,
      );
      await recordAiUsage({
        flow: "ld-extraction",
        taskId: metadata.taskId,
        taskLabel: metadata.taskLabel,
        provider: "mimo",
        model: configuration.fallback.model,
        operation,
        response: payload,
        durationMs: Date.now() - startedAt,
        userEmail: session.user.email,
        metadata: {
          fileName: metadata.fileName,
          pageNumber: metadata.pageNumber,
          cropMode: metadata.cropMode,
          source: metadata.source ?? (imageDataUrl ? "visual" : "text"),
          hasImage: Boolean(imageDataUrl),
          pdfTextChars: pdfText?.length ?? 0,
          fallbackReason: openAiFailure.category,
        },
      });

      return NextResponse.json({
        ...parsed,
        provider: "mimo",
        fallbackReason: openAiFailure.message,
        attempts: [
          asAttempt(openAiFailure),
          {
            provider: "mimo",
            model: configuration.fallback.model,
            status: "succeeded",
          },
        ],
      });
    } catch (mimoError) {
      const mimoFailure = classifyProviderFailure(
        "mimo",
        "ld-extraction",
        configuration.fallback.model,
        mimoError,
      );
      recordProviderFailure(mimoFailure);

      return NextResponse.json(
        {
          error: `${openAiFailure.message} ${mimoFailure.message}`,
          attempts: [asAttempt(openAiFailure), asAttempt(mimoFailure)],
        },
        { status: getFailureStatus(mimoFailure) },
      );
    }
  }

  return NextResponse.json(
    {
      error: `${openAiFailure.message} O fallback MiMo não está configurado no backend.`,
      attempts: [
        asAttempt(openAiFailure),
        {
          provider: "mimo",
          model: configuration.fallback.model,
          status: "not_configured",
          category: "configuration",
          message: "A chave de MiMo não está configurada no backend.",
        },
      ],
    },
    { status: getFailureStatus(openAiFailure) },
  );
}
