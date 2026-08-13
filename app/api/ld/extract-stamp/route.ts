import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mensagemDeTetoEstourado, verificarTetoMensal } from "@/lib/ai-budget";
import { extractTokenUsage, recordAiUsage } from "@/lib/ai-usage";
import {
  classifyProviderFailure,
  createInvalidProviderResponseError,
  getAiConfiguration,
  recordProviderFailure,
  type SafeProviderFailure,
} from "@/lib/ai-providers";
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { refreshAiModelOverrideCache } from "@/lib/ai-model-config";

type StampExtraction = {
  disciplina: string | null;
  folha: number | null;
  total: number | null;
  numeroFolha: string | null;
  arquivo: string | null;
  conteudo: string | null;
  cliente: string | null;
  secretaria: string | null;
  obra: string | null;
  fase: string | null;
  tituloSecao: string | null;
  data: string | null;
  logoOrgao: string | null;
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
    secretaria: {
      type: ["string", "null"],
      description: "Secretaria emissora lida no cabeçalho, como SECRETARIA DE DESENVOLVIMENTO SUSTENTÁVEL E OBRAS ESTRUTURANTES - SEDES. Não é a prefeitura/órgão.",
    },
    obra: {
      type: ["string", "null"],
      description: "Nome da obra/projeto lido no cabeçalho ou rodapé da página.",
    },
    fase: {
      type: ["string", "null"],
      description:
        "Fase do projeto, como PROJETO EXECUTIVO, PROJETO BÁSICO ou ANTEPROJETO. NUNCA o valor da ESCALA (ex.: INDICADA, 1:50) nem a DATA. Se a folha não trouxer a fase, devolva null.",
    },
    tituloSecao: {
      type: ["string", "null"],
      description: "Título técnico da seção ou disciplina da LD, como PROJETO ESTRUTURAL CONCRETO.",
    },
    data: {
      type: ["string", "null"],
      description:
        "Valor do campo DATA do carimbo, exatamente como impresso (ex.: JUNHO/2026, JUN/26, 06/2026). NUNCA a ESCALA (ex.: 1:50) nem a REVISÃO. null se não aparecer.",
    },
    logoOrgao: {
      type: ["string", "null"],
      description:
        "A quem pertence o BRASÃO/logotipo de órgão público da página, segundo o que está ESCRITO nele ou imediatamente ao lado (ex.: PREFEITURA MUNICIPAL DE CHAPECÓ). Não adivinhe pelo desenho: se houver brasão sem nome legível, devolva null. O logotipo da empresa projetista NÃO é órgão — ignore-o.",
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
    "secretaria",
    "obra",
    "fase",
    "tituloSecao",
    "data",
    "logoOrgao",
    "confianca",
  ],
} as const;

const systemPrompt = `Leia a primeira prancha técnica para montar uma Lista de Documentos.

Extraia do selo da prancha:
- PRANCHA
- ARQUIVO
- CONTEÚDO
- DATA

Extraia também do cabeçalho ou rodapé da página, quando visível ou presente no texto extraído:
- Órgão/cliente
- Secretaria emissora (linha própria no cabeçalho, ex.: SECRETARIA DE DESENVOLVIMENTO SUSTENTÁVEL E OBRAS ESTRUTURANTES - SEDES; não confundir com a prefeitura/órgão)
- Nome da obra/projeto
- Fase do projeto
- Título técnico da seção/disciplina da LD
- A quem pertence o BRASÃO/logotipo de órgão público (campo logoOrgao)

O campo PRANCHA sempre existe no selo.
O campo ARQUIVO sempre existe no selo.
O campo CONTEÚDO sempre existe no selo.

Para cliente, obra, fase e título da seção, use apenas texto presente na página.
Não reescreva textos.
Não resuma.
Não complete informação ausente.

A IMAGEM É A AUTORIDADE quando ela discordar do texto extraído.
O texto de algumas pranchas vem de fonte sem mapa de caracteres e é recuperado antes de chegar aqui: as letras saem certas, mas os ACENTOS podem estar trocados (por exemplo "CHAPECI" ou "CHAPECÏ" onde a imagem mostra "CHAPECÓ", "REVITALIZAdO" onde a imagem mostra "REVITALIZAÇÃO"). Nesses campos, escreva o que a IMAGEM mostra, com a acentuação correta.
Fora dos acentos, não corrija ortografia.
Trechos marcados [ilegivel] não puderam ser recuperados: não os copie, e leia aquele campo pela imagem. Se nem pela imagem der, retorne null.
Copie o campo CONTEÚDO exatamente como aparece, exceto por juntar quebras de linha.
O campo CONTEÚDO/DESCRIÇÃO deve conter apenas a descrição técnica da prancha.
Não inclua rótulos ou valores de campos vizinhos do carimbo no CONTEÚDO, como IMP, DATA, ESCALA, REV, REVISÃO, VISTO, DESENHO, FOLHA, PRANCHA, ARQUIVO, RESPONSÁVEL ou CLIENTE.
Se o texto visual estiver próximo desses campos, pare o CONTEÚDO antes do primeiro rótulo vizinho.
O campo DATA é a data de emissão da prancha, impressa no carimbo. Copie como está, sem reescrever nem completar o ano. NÃO confunda com ESCALA (ex.: 1:50, INDICADA) nem com REVISÃO. Se o carimbo não trouxer data, devolva null.
O campo logoOrgao é a quem pertence o BRASÃO de órgão público, pelo que está ESCRITO nele ou colado a ele. Nunca deduza pelo desenho: brasão sem nome legível é null. A prancha costuma trazer DOIS logotipos — o do órgão contratante e o da empresa projetista. Só o do órgão entra aqui; o da projetista é null.
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
  /**
   * Quantos rótulos do carimbo o cliente achou para MEDIR o recorte do selo.
   * Zero significa que ele caiu no quadrante de reserva — e é exatamente essa
   * a leitura que merece desconfiança quando um campo sair errado. Sem o número
   * na telemetria, não há como saber, depois do fato, se a folha foi lida do
   * carimbo ou de um pedaço de desenho.
   */
  ancoras?: number;
};

type ExtractionTrackingContext = {
  operation: string;
  metadata: ExtractionMetadata;
  userEmail?: string | null;
  hasImage: boolean;
  pdfTextChars: number;
  conversationId?: string | null;
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
    fase: faseValida(extraction.fase),
    conteudo: cleanExtractedContentField(extraction.conteudo),
  };
}

/**
 * A FASE do projeto, ou `null` quando o que veio é valor de outro campo.
 *
 * No carimbo, "ESCALA: INDICADA" fica a duas linhas de onde a fase estaria, e o
 * modelo levou "INDICADA" para o campo `fase`. Isso saiu impresso no RODAPÉ DE
 * TODA PÁGINA da LD entregue — "PREFEITURA … – 084-25 – REFORMA E AMPLIAÇÃO …
 * – INDICADA – LISTA DE DOCUMENTOS".
 *
 * A regra é NEGATIVA de propósito: recusa o que comprovadamente não é fase
 * (escala, data, revisão) em vez de exigir uma lista fechada de fases válidas.
 * Um escritório que escreva "PROJETO LEGAL" ou "AS BUILT" continua passando; o
 * preço de uma lista positiva seria zerar a fase de quem usa um nome que não
 * previmos, e aí o rodapé sairia vazio em vez de errado.
 *
 * Nulo aqui não deixa buraco: `buildLdProposal` cai em "PROJETO EXECUTIVO".
 */
function faseValida(valor: string | null): string | null {
  const bruto = valor?.trim();
  if (!bruto) return null;
  const normalizado = bruto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  // Escala: "INDICADA", "1:50", "1/25", "SEM ESCALA", "S/ESC".
  if (/^indicada?$/.test(normalizado)) return null;
  if (/^\d+\s*[:/]\s*\d+$/.test(normalizado)) return null;
  if (/^(s\/?\s*esc|sem\s+escala)/.test(normalizado)) return null;
  // Data: "JUNHO/2026", "JUN/26", "06/2026".
  if (/^[a-z]{3,10}\s*\/\s*\d{2,4}$/.test(normalizado)) return null;
  if (/^\d{1,2}\s*\/\s*\d{2,4}$/.test(normalizado)) return null;
  // Rótulo do carimbo lido como valor.
  if (["escala", "data", "rev", "revisao", "visto", "fase", "prancha"].includes(normalizado)) {
    return null;
  }
  return bruto;
}

function buildTextPrompt(pdfText?: string) {
  if (!pdfText) {
    return systemPrompt;
  }

  return `${systemPrompt}

O conteúdo abaixo foi extraído do PDF em ORDEM DE LEITURA: uma linha do carimbo por linha de texto, da esquerda para a direita.
A seção REGIÃO DO SELO é o recorte do carimbo — é dela que saem PRANCHA, ARQUIVO e CONTEÚDO, e é ela que a imagem mostra.
A seção PÁGINA COMPLETA vem depois e serve só para os campos que às vezes moram fora do carimbo (órgão, obra, fase).
Um rótulo e o seu valor podem cair na mesma linha ("ESCALA: INDICADA DATA: JUNHO/2026 ARQUIVO: 040_26_est_imp_001_a") ou o valor pode vir na linha seguinte ao rótulo.
Identifique os valores associados aos rótulos do selo sem usar o nome do arquivo enviado.
A secretaria é uma linha própria do cabeçalho (ex.: SECRETARIA DE DESENVOLVIMENTO SUSTENTÁVEL E OBRAS ESTRUTURANTES - SEDES), diferente da prefeitura/órgão.

TEXTO EXTRAÍDO:
${pdfText}`;
}

function buildExtractionUsageMetadata(
  metadata: ExtractionMetadata,
  hasImage: boolean,
  pdfTextChars: number,
  extra?: Record<string, unknown>,
) {
  return {
    fileName: metadata.fileName,
    pageNumber: metadata.pageNumber,
    cropMode: metadata.cropMode,
    source: metadata.source ?? (hasImage ? "visual" : "text"),
    ancoras: metadata.ancoras,
    hasImage,
    pdfTextChars,
    ...extra,
  };
}

async function extractWithOpenAi(
  model: string,
  textPrompt: string,
  imageDataUrl: string | undefined,
  tracking: ExtractionTrackingContext,
) {
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

  const result = await executeOpenAiResponse({
    flow: "ld-extraction",
    taskId: tracking.metadata.taskId,
    taskLabel: tracking.metadata.taskLabel,
    model,
    operation: tracking.operation,
    userEmail: tracking.userEmail,
    conversationId: tracking.conversationId,
    metadata: buildExtractionUsageMetadata(
      tracking.metadata,
      tracking.hasImage,
      tracking.pdfTextChars,
    ),
    request: {
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
    },
  });

  try {
    return {
      parsed: sanitizeStampExtraction(JSON.parse(result.text) as StampExtraction),
      response: result.response,
      model: result.model,
    };
  } catch {
    throw createInvalidProviderResponseError();
  }
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
  await refreshAiModelOverrideCache();

  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  // A leitura de selo é o passo mais caro do fluxo de volume (um modelo por
  // folha): sem teto aqui, a proteção da fatura teria um buraco do tamanho de
  // um projeto inteiro.
  const teto = await verificarTetoMensal({
    userId: session.user.id ?? null,
    userEmail: session.user.email ?? null,
  });
  if (teto.estourou) {
    return NextResponse.json({ error: mensagemDeTetoEstourado(teto) }, { status: 402 });
  }

  const body = (await request.json()) as {
    imageDataUrl?: unknown;
    pdfText?: unknown;
    metadata?: ExtractionMetadata;
    conversationId?: unknown;
  };
  const imageDataUrl = isValidImageDataUrl(body.imageDataUrl) ? body.imageDataUrl : undefined;
  const pdfText = isValidPdfText(body.pdfText) ? body.pdfText : undefined;
  const metadata = body.metadata ?? {};
  const conversationId =
    typeof body.conversationId === "string" && body.conversationId.trim()
      ? body.conversationId.trim()
      : null;
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
  let primaryFailure: SafeProviderFailure;

  try {
    const { parsed, response, model } = await extractWithOpenAi(
      configuration.primary.model,
      textPrompt,
      imageDataUrl,
      {
        operation,
        metadata,
        userEmail: session.user.email,
        hasImage: Boolean(imageDataUrl),
        pdfTextChars: pdfText?.length ?? 0,
        conversationId,
      },
    );
    const usage = extractTokenUsage(response);

    return NextResponse.json({
      ...parsed,
      provider: configuration.primary.provider,
      model,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      attempts: [{
        provider: configuration.primary.provider,
        model,
        status: "succeeded",
      }],
    });
  } catch (error) {
    primaryFailure = classifyProviderFailure(
      configuration.primary.provider,
      "ld-extraction",
      configuration.primary.model,
      error,
    );
    recordProviderFailure(primaryFailure);
  }

  /*
   * Havia aqui um fallback para o MiMo quando a leitura primária falhava. Ele
   * saiu com a centralização na OpenAI (13/08/2026) — a última chamada ao MiMo
   * é de 26/06/2026, e um fallback que ninguém exercita há sete semanas é uma
   * promessa de resiliência que nunca foi conferida.
   *
   * A CONSEQUÊNCIA É REAL e está escrita aqui para não surpreender: falha da
   * primária agora é falha da rota. Em compensação ela é ALTA — antes, uma
   * queda da OpenAI virava leitura do MiMo com qualidade diferente e o volume
   * saía misturado sem ninguém notar. Errar barulhento é melhor que acertar
   * pela metade em silêncio.
   */
  return NextResponse.json(
    {
      error: primaryFailure.message,
      attempts: [asAttempt(primaryFailure)],
    },
    { status: getFailureStatus(primaryFailure) },
  );
}
