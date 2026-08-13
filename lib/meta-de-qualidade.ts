/**
 * A META DE QUALIDADE e a SÉRIE SEMANAL — o painel de Quality deixa de ser uma
 * foto e vira uma tendência com destino declarado.
 *
 * O painel já dizia "falso positivo: 12,4%". Faltavam as duas perguntas que
 * fazem esse número significar alguma coisa: **12,4% está bom?** e **está
 * melhorando?**. Sem meta, todo número é aceitável; sem série, todo número é
 * ruído — e as duas faltas juntas explicam por que a tela nunca mudou nenhuma
 * decisão.
 *
 * A META É DECLARADA, como a cotação do dólar. Não há meta "de fábrica" e o
 * default não é um número inventado por quem escreveu o código: é **nenhuma**,
 * e a tela diz "meta não declarada". Uma meta chutada seria pior que meta
 * nenhuma, porque a partir dela o painel passaria a aprovar e reprovar sozinho.
 *
 * PURO: nenhum import. Roda em node cru (`npm run test:meta-qualidade`).
 */

export interface MetasDeQualidade {
  /** Teto aceitável de falso positivo, em %. Zero = não declarada. */
  falsoPositivoMax: number;
  /** Piso de cobertura de revisão, em %. Zero = não declarada. */
  coberturaMin: number;
  declaradaEm: string;
  declaradaPor: string;
}

export const METAS_NAO_DECLARADAS: MetasDeQualidade = {
  falsoPositivoMax: 0,
  coberturaMin: 0,
  declaradaEm: "",
  declaradaPor: "",
};

function percentual(bruto: unknown): number {
  const numero =
    typeof bruto === "number" ? bruto : parseFloat(String(bruto ?? "").replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.min(100, numero);
}

export function normalizarMetas(bruto: unknown): MetasDeQualidade {
  const fonte = (bruto ?? {}) as Partial<Record<keyof MetasDeQualidade, unknown>>;
  return {
    falsoPositivoMax: percentual(fonte.falsoPositivoMax),
    coberturaMin: percentual(fonte.coberturaMin),
    declaradaEm: typeof fonte.declaradaEm === "string" ? fonte.declaradaEm.trim() : "",
    declaradaPor: typeof fonte.declaradaPor === "string" ? fonte.declaradaPor.trim() : "",
  };
}

export function validarMetas(metas: MetasDeQualidade): string[] {
  const erros: string[] = [];
  if (metas.falsoPositivoMax < 0 || metas.falsoPositivoMax > 100) {
    erros.push("O teto de falso positivo é uma porcentagem entre 0 e 100.");
  }
  if (metas.coberturaMin < 0 || metas.coberturaMin > 100) {
    erros.push("O piso de cobertura de revisão é uma porcentagem entre 0 e 100.");
  }
  return erros;
}

/** Como um número se compara à meta. "sem-meta" NÃO é aprovação. */
export type SituacaoContraMeta = "dentro" | "fora" | "sem-meta" | "sem-dado";

export function situacaoDoFalsoPositivo(
  taxa: number | null,
  metas: MetasDeQualidade,
): SituacaoContraMeta {
  if (metas.falsoPositivoMax <= 0) return "sem-meta";
  if (taxa === null) return "sem-dado";
  return taxa <= metas.falsoPositivoMax ? "dentro" : "fora";
}

export function situacaoDaCobertura(
  taxa: number | null,
  metas: MetasDeQualidade,
): SituacaoContraMeta {
  if (metas.coberturaMin <= 0) return "sem-meta";
  if (taxa === null) return "sem-dado";
  return taxa >= metas.coberturaMin ? "dentro" : "fora";
}

// --- Série semanal ---

export interface AuditoriaParaSerie {
  /** ISO de quando a auditoria foi criada. */
  createdAt: string;
  totalFindings: number;
  veredictos: readonly ("CONFIRMED" | "FALSE_POSITIVE" | "WRONG_SEVERITY" | "MISSING_FINDING")[];
}

export interface SemanaDeQualidade {
  /** Segunda-feira da semana, em ISO curto (YYYY-MM-DD). É a chave e o rótulo. */
  semana: string;
  auditorias: number;
  auditoriasRevisadas: number;
  achados: number;
  confirmados: number;
  falsosPositivos: number;
  /** % de falso positivo entre os achados julgados. `null` sem julgamento. */
  taxaFalsoPositivo: number | null;
  /** % de auditorias que alguém revisou. `null` sem auditoria na semana. */
  cobertura: number | null;
}

/** A segunda-feira da semana de uma data, em YYYY-MM-DD (UTC). */
export function segundaDaSemana(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const dia = data.getUTCDay();
  // getUTCDay: 0 = domingo. A semana do ofício começa na segunda.
  const recuo = dia === 0 ? 6 : dia - 1;
  const segunda = new Date(data.getTime() - recuo * 86_400_000);
  return segunda.toISOString().slice(0, 10);
}

function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * A série, da semana mais antiga para a mais recente. `semanas` limita quantas
 * voltam — e o corte é por CONTAGEM DE SEMANAS COM DADO, não por janela de
 * calendário: semana sem auditoria não vira linha vazia, porque uma sequência
 * de zeros lida como queda de qualidade quando é só férias.
 */
export function serieSemanal(
  auditorias: readonly AuditoriaParaSerie[],
  semanas = 8,
): SemanaDeQualidade[] {
  const porSemana = new Map<string, SemanaDeQualidade>();

  for (const auditoria of auditorias) {
    const semana = segundaDaSemana(auditoria.createdAt);
    if (!semana) continue;

    const linha = porSemana.get(semana) ?? {
      semana,
      auditorias: 0,
      auditoriasRevisadas: 0,
      achados: 0,
      confirmados: 0,
      falsosPositivos: 0,
      taxaFalsoPositivo: null,
      cobertura: null,
    };

    linha.auditorias += 1;
    linha.achados += auditoria.totalFindings;
    if (auditoria.veredictos.length > 0) linha.auditoriasRevisadas += 1;

    for (const veredicto of auditoria.veredictos) {
      if (veredicto === "CONFIRMED") linha.confirmados += 1;
      else if (veredicto === "FALSE_POSITIVE") linha.falsosPositivos += 1;
    }

    porSemana.set(semana, linha);
  }

  const fechadas = [...porSemana.values()].map((linha) => {
    /*
     * O denominador é o que foi JULGADO, não o que foi gerado. Dividir pelo
     * total de achados faria a taxa despencar sempre que alguém deixasse de
     * revisar — melhora aparente por preguiça, que é o pior tipo de métrica.
     */
    const julgados = linha.confirmados + linha.falsosPositivos;
    return {
      ...linha,
      taxaFalsoPositivo: julgados > 0 ? arredondar((linha.falsosPositivos / julgados) * 100) : null,
      cobertura:
        linha.auditorias > 0
          ? arredondar((linha.auditoriasRevisadas / linha.auditorias) * 100)
          : null,
    };
  });

  return fechadas.sort((a, b) => a.semana.localeCompare(b.semana)).slice(-semanas);
}

/**
 * Para onde a taxa está indo entre as duas últimas semanas COM julgamento.
 * `null` quando não há duas — e nesse caso a tela não desenha seta nenhuma, em
 * vez de desenhar uma seta plana que sugere estabilidade que ninguém mediu.
 */
export function tendenciaDoFalsoPositivo(serie: readonly SemanaDeQualidade[]): number | null {
  const comDado = serie.filter((s) => s.taxaFalsoPositivo !== null);
  if (comDado.length < 2) return null;
  const ultima = comDado[comDado.length - 1].taxaFalsoPositivo!;
  const anterior = comDado[comDado.length - 2].taxaFalsoPositivo!;
  return arredondar(ultima - anterior);
}
