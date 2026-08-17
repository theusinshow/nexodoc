/**
 * O PARECER ANTERIOR SERVE DE BASE PARA REUSO?
 *
 * Separado de [[audit-reuso.ts]] porque responde outra pergunta: aquele decide
 * O QUE RELER dado que a base presta; este decide SE ELA PRESTA.
 *
 * O portão que importa é `analise-parcial`. Em 17/08/2026 uma auditoria do
 * memorial 084_25 truncou 20 dos 25 blocos por estouro do teto de saída. Se o
 * reuso estivesse ligado, a reauditoria seguinte herdaria capítulos que nunca
 * foram lidos de verdade — e o buraco viraria permanente, porque cada corrida
 * confirmaria o vazio da anterior. Reuso AMPLIFICA a base: base furada, furo
 * maior.
 *
 * Recusar NÃO é erro. A auditoria roda inteira, como sempre rodou, e o parecer
 * diz por que não houve reuso.
 *
 * PURO: recebe o parecer já carregado. Quem fala com o banco é a rota.
 */
import type { AuditReport, CapituloImpresso } from "./audit-report.ts";

export type BaseDaReauditoria = {
  auditId: string;
  /** `status` da linha `Audit` — só "COMPLETED" afirma alguma coisa. */
  status: string;
  report: AuditReport | null;
};

export type MotivoDeRecusa =
  | "sem-base"
  | "nao-completou"
  | "analise-parcial"
  | "sem-impressao"
  | "versao-diferente"
  | "outro-arquivo";

export type Elegibilidade =
  | { serve: true; impressao: CapituloImpresso[] }
  | { serve: false; motivo: MotivoDeRecusa };

export function avaliarBase(args: {
  base: BaseDaReauditoria | null;
  /** Nome do arquivo QUE ESTÁ SENDO auditado agora. */
  arquivo: string;
  versaoAtual: string;
}): Elegibilidade {
  const { base, arquivo, versaoAtual } = args;

  if (!base || !base.report) {
    return { serve: false, motivo: "sem-base" };
  }

  if (base.status !== "COMPLETED") {
    return { serve: false, motivo: "nao-completou" };
  }

  const runtime = base.report.runtime;

  if ((runtime?.passadas_incompletas?.length ?? 0) > 0) {
    return { serve: false, motivo: "analise-parcial" };
  }

  /*
   * Comparação de STRING contra STRING. Parecer anterior a esta mudança gravou
   * o número 1; `String(1) !== hash` recusa sozinho, sem caso especial.
   */
  if (String(runtime?.versao_auditor ?? "") !== versaoAtual) {
    return { serve: false, motivo: "versao-diferente" };
  }

  if (!runtime?.impressao?.length) {
    return { serve: false, motivo: "sem-impressao" };
  }

  // `impressao` é POR ARQUIVO, e o nome é o único elo entre as duas corridas.
  const doArquivo = runtime.impressao.find((i) => i.arquivo === arquivo);

  if (!doArquivo?.capitulos?.length) {
    return { serve: false, motivo: "outro-arquivo" };
  }

  return { serve: true, impressao: doArquivo.capitulos };
}

/**
 * Por que não houve reuso, em linguagem de documento. Nenhuma frase diz "erro":
 * não houve erro nenhum — houve ausência de base comparável, e a auditoria
 * completa é o desfecho normal, não a punição.
 */
export function fraseDaRecusa(motivo: MotivoDeRecusa): string {
  switch (motivo) {
    case "sem-base":
      return "Primeira auditoria deste memorial: não há parecer anterior para comparar.";
    case "nao-completou":
      return "A auditoria anterior não chegou ao fim, então não serve de referência.";
    case "analise-parcial":
      return "A auditoria anterior ficou parcial — parte do documento não foi lida. Este memorial foi lido inteiro de novo.";
    case "sem-impressao":
      return "O parecer anterior é de uma versão que ainda não guardava a impressão por capítulo.";
    case "versao-diferente":
      return "O auditor mudou desde o parecer anterior (prompt, modelo ou recorte), então o documento foi lido inteiro.";
    case "outro-arquivo":
      return "O parecer anterior é de outro arquivo; não há capítulos para comparar.";
  }
}
