/**
 * A CONFIGURAÇÃO QUE DEFINE O AUDITOR — lida uma vez, para as duas rotas.
 *
 * [[versao-do-auditor.ts]] é aritmética pura de propósito ("quem busca modelo e
 * prompt é a rota"). Enquanto só a rota de auditoria precisava do hash, isso
 * bastava: ela montava a configuração inline.
 *
 * Deixou de bastar em 02/09/2026, quando `/api/audit/delta` passou a PROCURAR a
 * base da reauditoria no projeto. A busca precisa aplicar o mesmo portão que a
 * auditoria vai aplicar — `avaliarBase`, que recusa base de auditor diferente —,
 * e sem a versão ela ofereceria uma base que a auditoria depois recusa. É o
 * defeito de `ae5d47f` voltando pela porta ao lado: o cartão prometendo economia
 * que a corrida não entrega.
 *
 * Então a leitura da configuração saiu da rota e veio para cá. `CHUNK_GROUP_CHARS`
 * e `getReasoningEffort` continuam sendo os mesmos valores de sempre — a rota os
 * importa de volta, e não há segunda cópia deles em lugar nenhum.
 */
import { getAuditExecutionProfile, type AuditAnalysisLevel, type AuditMode } from "./ai-providers.ts";
import { getAuditorPrompt } from "./auditor-prompt.ts";
import { versaoDoAuditor, type ConfiguracaoDoAuditor } from "./versao-do-auditor.ts";

/**
 * O tamanho do bloco de leitura. Bloco maior muda o que o modelo acha, então ele
 * entra no hash da versão — ver o cabeçalho de [[versao-do-auditor.ts]].
 */
export const CHUNK_GROUP_CHARS = 10000;

const DEFAULT_REASONING_EFFORT = "high";

export function getReasoningEffort(analysisLevel: AuditAnalysisLevel, auditMode: AuditMode) {
  const effort =
    analysisLevel === "deep"
      ? process.env.OPENAI_DEEP_REASONING_EFFORT ?? process.env.OPENAI_REASONING_EFFORT
      : process.env.OPENAI_STANDARD_REASONING_EFFORT;

  if (auditMode === "memorial" && analysisLevel === "deep") {
    if (effort === "minimal") {
      return "none";
    }

    if (
      effort === "none" ||
      effort === "low" ||
      effort === "medium" ||
      effort === "high" ||
      effort === "xhigh"
    ) {
      return effort;
    }

    /*
     * Memorial no Profundo: `medium`, não `high`.
     *
     * Medido no 063_26_md_geral_a.pdf (73 páginas, 173k chars) em 12/08/2026,
     * com o prompt de "pecar pelo excesso":
     *   high   -> abortou em 480s; abortou de novo em 900s; 0 achado de IA.
     *   medium -> 258s, 35 achados de IA, out=13.893 de 16.000.
     *
     * Não é economia: o `high` simplesmente não converge quando a passada lê o
     * documento inteiro e o pedido é exaustivo. Subir o teto de tempo já falhou
     * duas vezes; quem quiser `high` precisa antes dividir a leitura global em
     * duas passadas por faixa de impacto, não dar mais minutos.
     *
     * `OPENAI_DEEP_REASONING_EFFORT=high` continua funcionando para quem quiser
     * tentar — em documento pequeno o `high` termina normalmente.
     */
    return "medium";
  }

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

  return analysisLevel === "deep" ? DEFAULT_REASONING_EFFORT : "medium";
}

/**
 * A configuração desta corrida, pronta para virar hash.
 *
 * Os modelos saem de `getAuditExecutionProfile`, que já é a fonte única deles
 * (inclusive dos overrides do painel admin): um modelo trocado no painel muda a
 * versão sozinho, e todo parecer do auditor antigo para de servir de base sem
 * ninguém subir constante nenhuma.
 */
export function configuracaoDoAuditor(
  auditMode: AuditMode,
  analysisLevel: AuditAnalysisLevel,
): ConfiguracaoDoAuditor {
  const modelo = (role: "global" | "chunk") =>
    getAuditExecutionProfile({ auditMode, analysisLevel, role }).model;

  return {
    prompt: getAuditorPrompt(auditMode),
    modeloGlobal: modelo("global"),
    modeloBloco: modelo("chunk"),
    modeloValidacao: getAuditExecutionProfile({ auditMode, analysisLevel, role: "validation" })
      .model,
    esforco: getReasoningEffort(analysisLevel, auditMode),
    tamanhoDoBloco: CHUNK_GROUP_CHARS,
  };
}

/** O hash do auditor desta corrida — o que `avaliarBase` compara. */
export function versaoDoAuditorDaCorrida(
  auditMode: AuditMode = "memorial",
  analysisLevel: AuditAnalysisLevel = "standard",
): string {
  return versaoDoAuditor(configuracaoDoAuditor(auditMode, analysisLevel));
}
