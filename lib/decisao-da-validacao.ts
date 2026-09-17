/**
 * O QUE A VALIDAÇÃO PODE FAZER COM UM ACHADO.
 *
 * Saiu de `validateFindingsWithModel` (`app/api/audit/route.ts`) em 17/09/2026
 * para poder ser testado sem token: a decisão do modelo chega, esta função
 * devolve o achado resultante.
 *
 * A CAMADA DETERMINÍSTICA É DONA DA PRÓPRIA FAIXA.
 *
 * Achado de regra e guarda obrigatória já não podiam ser REMOVIDOS pela
 * validação (Fase C). Podiam ser REBAIXADOS: no 027-24 a regra da hierarquia
 * documental emitiu crítico — decisão de negócio de 12/08/2026, escrita na
 * própria regra — e a validação o levou a técnico. A regra não alucina; se ela
 * errou a faixa, o conserto é na regra, e para isso o desacordo precisa chegar a
 * quem mexe nela. Por isso o pedido de outra faixa vira contestação, como a
 * remoção já virava. Ver [[contestacao-de-regra.ts]].
 *
 * PURO: sem modelo, sem banco.
 */
import {
  normalizeConfidence,
  normalizePriority,
  type AuditFinding,
  type FindingImpact,
} from "./audit-report.ts";
import { registrarContestacao, type ContestacaoDeRegra } from "./contestacao-de-regra.ts";

/** Uma decisão da validação, como o modelo a devolve (campos livres). */
export type DecisaoDaValidacao = {
  acao?: string;
  prioridade?: string;
  impacto?: string;
  tipo?: string;
  descricao?: string;
  conflito?: string;
  sugestao_correcao?: string;
  confianca?: string;
  motivo?: string;
};

const FAIXAS: readonly FindingImpact[] = [
  "critico_documental",
  "tecnico_contratual",
  "revisao_editorial",
];

function faixaDaDecisao(valor: string | undefined): FindingImpact | undefined {
  return FAIXAS.find((f) => f === valor);
}

/** Achado que a validação não apaga nem rebaixa: regra e guarda obrigatória. */
export function ehDaCamadaDeterministica(finding: AuditFinding): boolean {
  return finding.origem === "regra" || finding.id.startsWith("GUARDA-");
}

function texto(novo: unknown, atual: string): string {
  return String(novo ?? atual).trim() || atual;
}

export function aplicarDecisaoDaValidacao(
  finding: AuditFinding,
  decisao: DecisaoDaValidacao,
  contestacoes?: ContestacaoDeRegra[],
): AuditFinding {
  const deterministico = ehDaCamadaDeterministica(finding);

  if (decisao.acao === "remover") {
    if (deterministico) {
      /*
       * O ACHADO FICA, MAS O DESACORDO NÃO SE PERDE. Em 18/08/2026 a
       * validação pediu remoção de 4 dos 6 achados de regra de um lote, e três
       * motivos eram diagnósticos corretos de defeito nosso — que a camada que
       * já sabia deixava calados.
       */
      contestacoes?.push(registrarContestacao(finding, decisao.motivo));
      return finding;
    }

    // Recall: achado de IA incerto vira "Sugestão" (camada recolhível), não some.
    return {
      ...finding,
      tier: "sugestao",
      confianca: "baixa",
      impacto: "revisao_editorial",
      prioridade: normalizePriority(decisao.prioridade ?? "Baixa"),
      tipo: texto(decisao.tipo, finding.tipo),
      descricao: texto(decisao.descricao, finding.descricao),
      conflito: texto(decisao.conflito, finding.conflito),
      sugestao_correcao: texto(decisao.sugestao_correcao, finding.sugestao_correcao),
    };
  }

  const pedida = faixaDaDecisao(decisao.impacto);

  if (deterministico) {
    if (pedida && finding.impacto && pedida !== finding.impacto) {
      contestacoes?.push(
        registrarContestacao(
          finding,
          `pediu a faixa ${pedida} no lugar de ${finding.impacto}: ${decisao.motivo ?? "sem motivo declarado"}`,
        ),
      );
    }
    /*
     * A redação do modelo continua valendo (ela costuma melhorar a descrição);
     * a faixa e a confiança são da regra.
     */
    return {
      ...finding,
      tipo: texto(decisao.tipo, finding.tipo),
      descricao: texto(decisao.descricao, finding.descricao),
      conflito: texto(decisao.conflito, finding.conflito),
      sugestao_correcao: texto(decisao.sugestao_correcao, finding.sugestao_correcao),
    };
  }

  return {
    ...finding,
    prioridade: normalizePriority(decisao.prioridade ?? finding.prioridade),
    impacto: pedida ?? finding.impacto,
    tipo: texto(decisao.tipo, finding.tipo),
    descricao: texto(decisao.descricao, finding.descricao),
    conflito: texto(decisao.conflito, finding.conflito),
    sugestao_correcao: texto(decisao.sugestao_correcao, finding.sugestao_correcao),
    confianca: normalizeConfidence(decisao.confianca ?? finding.confianca),
  };
}
