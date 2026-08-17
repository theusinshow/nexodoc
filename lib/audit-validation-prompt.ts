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
import {
  classifyFindingImpact,
  type AuditFinding,
  type CapituloImpresso,
} from "./audit-report.ts";
import type { AnalysisLevel } from "./analysis-level.ts";
import { paginasDoAchado } from "./paginas-do-achado.ts";
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

/** Orçamento de contexto da validação, em caracteres. */
const VALIDACAO_MAX_CHARS = 90_000;
/** Páginas vizinhas incluídas junto da página do achado, de cada lado. */
const VIZINHAS = 1;

/**
 * O CONTEXTO DA VALIDAÇÃO: as PÁGINAS DOS ACHADOS, não uma amostra do documento.
 *
 * Até 17/08/2026 esta função chamava `buildDocumentContext` **sem o nível** —
 * caindo no recorte de 90k do Padrão mesmo numa auditoria profunda — e depois
 * cortava em 45k por arquivo. Num memorial de 547.855 caracteres, o validador
 * julgava com **8% do documento**.
 *
 * A consequência é verificável: os falsos positivos "Escola Geral" (p. 181) do
 * 084_25 sobreviveram porque a validação **nunca viu a página 181**. Um
 * validador que não enxerga a página do achado não valida — carimba.
 *
 * A troca é de ESTRATÉGIA, não de tamanho: em vez de gastar o orçamento numa
 * amostra que ignora onde os achados estão, gasta-se nas páginas que eles
 * citam, mais uma vizinha de cada lado — o trecho costuma atravessar a virada.
 * Com algumas dezenas de achados isso cabe folgado no mesmo orçamento, e é a
 * diferença entre poder refutar e ter de acreditar.
 *
 * Sem página resolvível em achado nenhum, cai na amostragem antiga: contexto
 * genérico é pior que o certo, e melhor que nenhum.
 */
export function buildValidationContext(
  files: ValidationContextFile[],
  findings: readonly AuditFinding[] = [],
) {
  const alvo = new Map<string, Set<number>>();

  for (const finding of findings) {
    const paginas = paginasDoAchado({
      pagina: finding.pagina,
      referencia: finding.referencia_comparada,
    });
    if (paginas.length === 0) continue;

    // Sem `arquivo`, o achado é do único arquivo em análise — o caso comum.
    const chave = finding.arquivo ?? files[0]?.file.name ?? "";
    const set = alvo.get(chave) ?? new Set<number>();
    for (const p of paginas) {
      for (let d = -VIZINHAS; d <= VIZINHAS; d += 1) {
        if (p + d > 0) set.add(p + d);
      }
    }
    alvo.set(chave, set);
  }

  const temAlvo = [...alvo.values()].some((s) => s.size > 0);
  let restante = VALIDACAO_MAX_CHARS;

  return files
    .map((file) => {
      const paginas = alvo.get(file.file.name);
      const focalizado = temAlvo && Boolean(paginas?.size);
      const texto = focalizado
        ? file.extracted.pages
            .filter((p) => paginas!.has(p.page))
            .map((p) => `--- PÁGINA ${p.page} ---\n${p.text}`)
            .join("\n\n")
            .slice(0, restante)
        : buildDocumentContext(file.extracted).slice(0, Math.min(restante, 45_000));

      restante -= texto.length;

      return [
        `ARQUIVO: ${file.file.name}`,
        `TIPO: ${file.fileType}`,
        `PÁGINAS: ${file.extracted.pageCount}`,
        focalizado
          ? "TEXTO DE CONTEXTO (as páginas citadas pelos achados):"
          : "TEXTO DE CONTEXTO:",
        texto,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * O MAPA COMPRIMIDO dos capítulos que não mudaram, para a reauditoria barata.
 *
 * Mora aqui, ao lado do `buildValidationContext`, porque são irmãos: os dois
 * comprimem o documento para caber num prompt que não pode recebê-lo inteiro.
 *
 * Existe por um motivo só: sem ele, a leitura que recebe apenas o delta não tem
 * como notar que o capítulo novo do metálico contradiz a fundação do capítulo 3.
 * A passada de validação não cobre isso — o prompt dela diz, literalmente, que a
 * tarefa dela não é procurar erros novos.
 *
 * Capítulo SEM síntese entra assim mesmo, só com título e páginas: omiti-lo
 * faria o modelo achar que o documento é menor do que é, e um capítulo
 * invisível não pode ser contradito.
 */
export function buildMapaDosIguais(
  capitulos: readonly CapituloImpresso[],
  sintese: readonly { hash: string; resumo: string }[],
): string {
  if (capitulos.length === 0) return "";

  const porHash = new Map(sintese.map((s) => [s.hash, s.resumo]));

  return capitulos
    .map((c) => {
      const resumo = porHash.get(c.hash);
      const cabeca = `${c.titulo || "(sem título)"} [p. ${c.startPage}-${c.endPage}]`;
      return resumo ? `${cabeca}: ${resumo}` : cabeca;
    })
    .join("\n");
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
${buildValidationContext(args.files, args.findings)}
`.trim();
}

/**
 * O DOCUMENTO como a leitura global o vê numa REAUDITORIA.
 *
 * Capítulo que não mudou entra como uma LINHA de resumo; o que mudou entra
 * inteiro. É para isso que `runtime.sintese` é gravado em todo parecer — sem
 * ele, a passada mais cara da auditoria (US$ 1,19 medidos no 084_25 em
 * 17/08/2026) continuaria relendo o documento todo, e o reuso teria piso alto
 * mesmo com todos os blocos economizados.
 *
 * O TÍTULO do capítulo herdado fica SEMPRE, mesmo resumido: é ele que deixa o
 * modelo enxergar a estrutura do documento e perceber que o capítulo novo
 * contradiz um que ficou parado. Um contexto só com os capítulos mudados leria
 * o delta como se fosse o documento inteiro — e concluiria coisas sobre um
 * memorial que não existe.
 *
 * Herdado SEM resumo gravado volta a ir como texto integral: parecer antigo pode
 * ter impressão e não ter síntese, e mandar uma linha em branco esconderia o
 * conteúdo do modelo. O lado seguro aqui é gastar, não perder.
 */
export function buildDocumentContextComReuso(args: {
  capitulos: readonly { hash: string; titulo: string; texto: string }[];
  hashesHerdados: ReadonlySet<string>;
  resumoPorHash: ReadonlyMap<string, string>;
  maxChars: number;
}): string {
  const partes = args.capitulos.map((cap) => {
    const resumo = args.resumoPorHash.get(cap.hash);

    if (args.hashesHerdados.has(cap.hash) && resumo) {
      return `--- ${cap.titulo} (inalterado desde a auditoria anterior; resumo) ---\n${resumo}`;
    }

    return `--- ${cap.titulo} ---\n${cap.texto}`;
  });

  const texto = partes.join("\n\n");

  return texto.length <= args.maxChars ? texto : `${texto.slice(0, args.maxChars)}\n[...]`;
}
