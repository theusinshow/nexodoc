/**
 * O PROMPT DA PASSADA DE VALIDAÇÃO, e o recorte de documento que ele carrega.
 *
 * Morava dentro de `app/api/audit/route.ts`, e por isso não havia como medir a
 * validação sem rodar uma auditoria inteira — a rota puxa `next/server` e uma
 * dúzia de atalhos `@/`, que só o bundler resolve. Aqui fora, um harness
 * consegue montar o MESMO texto que a produção manda e comparar dois modelos
 * sobre a mesma entrada.
 *
 * Imports relativos de propósito (mesmo motivo de `audit-fingerprint.ts`): com
 * `@/` no caminho de valor, este arquivo volta a só rodar dentro do Next.
 *
 * Nada aqui mudou de comportamento na extração — as funções foram movidas
 * palavra por palavra.
 */
import { classifyFindingImpact, type AuditFinding } from "./audit-report.ts";
import type { AnalysisLevel } from "./analysis-level.ts";
import type { ExtractedPdf } from "./pdf-text.ts";

const DEFAULT_GLOBAL_CONTEXT_CHARS = 90_000;
// Teto do nível Profundo: grande o bastante para o memorial inteiro caber numa
// leitura só (memoriais reais têm ~300k chars; damos folga para os maiores).
const DEFAULT_DEEP_GLOBAL_CONTEXT_CHARS = 700_000;

/**
 * O arquivo, reduzido ao que o prompt precisa. Estrutural de propósito: o
 * `UploadedAuditFile` da rota se encaixa sem conversão, e o harness monta um
 * objeto simples sem precisar de um `File` de verdade.
 */
export type ValidationContextFile = {
  file: { name: string };
  fileType: string;
  extracted: ExtractedPdf;
};

export function getGlobalContextChars(analysisLevel: AnalysisLevel = "standard") {
  const value = Number(process.env.NEXODOC_GLOBAL_CONTEXT_CHARS);

  if (Number.isFinite(value) && value >= 40_000) {
    return Math.min(1_200_000, Math.floor(value));
  }

  return analysisLevel === "deep" ? DEFAULT_DEEP_GLOBAL_CONTEXT_CHARS : DEFAULT_GLOBAL_CONTEXT_CHARS;
}

export function buildDocumentContext(
  extracted: ExtractedPdf,
  analysisLevel: AnalysisLevel = "standard",
) {
  const maxChars = getGlobalContextChars(analysisLevel);

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

/**
 * ATENÇÃO ao nível: esta função chama `buildDocumentContext` SEM passar
 * `analysisLevel`, então o recorte é sempre o de "standard" (90k) — mesmo numa
 * auditoria profunda — e depois é cortado em 45k por arquivo, 90k no total. A
 * validação julga com uma fração do documento, e é assim de propósito: ela não
 * procura achado novo, confere os que já existem.
 */
export function buildValidationContext(files: ValidationContextFile[]) {
  let remainingCharacters = 90_000;

  return files
    .map((file) => {
      const text = buildDocumentContext(file.extracted).slice(
        0,
        Math.min(remainingCharacters, 45_000),
      );
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

export function buildFindingCandidateList(findings: AuditFinding[]) {
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

/** O contrato de saída da validação. Vive junto do prompt que o promete. */
export const auditValidationResponseFormat = {
  type: "json_schema" as const,
  name: "audit_validation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            source_id: { type: "string" },
            acao: { type: "string", enum: ["confirmar", "rebaixar", "remover"] },
            prioridade: { type: "string" },
            impacto: {
              type: "string",
              enum: ["critico_documental", "tecnico_contratual", "revisao_editorial"],
            },
            tipo: { type: "string" },
            descricao: { type: "string" },
            conflito: { type: "string" },
            sugestao_correcao: { type: "string" },
            confianca: { type: "string" },
            motivo: { type: "string" },
          },
          required: [
            "source_id",
            "acao",
            "prioridade",
            "impacto",
            "tipo",
            "descricao",
            "conflito",
            "sugestao_correcao",
            "confianca",
            "motivo",
          ],
        },
      },
    },
    required: ["decisions"],
  },
};

export function getFindingValidationPrompt(args: {
  auditMode: string;
  userMessage: string;
  projectName: string;
  learningContext: string;
  files: ValidationContextFile[];
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
