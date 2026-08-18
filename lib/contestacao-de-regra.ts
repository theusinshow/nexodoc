/**
 * QUANDO A IA DISCORDA DE UMA REGRA, ISSO É UM BUG REPORT.
 *
 * A validação por IA pode reclassificar um achado, mas nunca apagar um achado de
 * REGRA — regras não alucinam e citam página e evidência. A proteção está certa
 * e continua valendo.
 *
 * O que estava errado era o que se fazia com o veredito recusado: nada. Ele era
 * descartado em silêncio.
 *
 * Em 18/08/2026, medindo a validação com falsos positivos plantados, ela pediu
 * remoção de 4 dos 6 achados de regra do lote — e três dos motivos eram
 * diagnósticos corretos de defeito NOSSO:
 *
 *   "Não há nome de outra obra, município, órgão ou endereço"
 *      -> a regra de identidade acusava "Unidade Básica de Saúde Vila Manaus"
 *         de divergir de "UBS Vila Manaus". Mesmo nome, por extenso.
 *
 *   "O candidato compara área construída com quantidade de pessoas"
 *      -> a regra de área lia a linha "Total" de um quadro de áreas e pegava
 *         o total de POPULAÇÃO, na coluna errada.
 *
 *   "A ressalva geral do próprio memorial alcança a especificação citada"
 *      -> a regra de marca exigia "ou similar" e recusava "Suvinil similar".
 *
 * Os três eram falsos positivos reais, e os três foram consertados no mesmo dia
 * — mas por acaso, porque eu fui olhar. A camada que já sabia estava calada.
 *
 * Registrar a contestação no parecer transforma a IA em revisora permanente da
 * camada determinística: ela lê o documento inteiro, vê o achado com a página
 * na frente, e é a única coisa no sistema capaz de dizer "esta regra errou".
 *
 * O achado NÃO muda. Só passa a carregar o desacordo junto.
 *
 * PURO: monta o registro, não decide nada.
 */
import type { AuditFinding } from "./audit-report.ts";

export type ContestacaoDeRegra = {
  /** Id do achado no parecer, para achá-lo depois. */
  achado: string;
  /** A regra que o produziu — é ela que precisa ser revista. */
  tipo: string;
  pagina: string;
  /** O que a validação alegou. É a frase que vale ler. */
  motivo: string;
  /** O trecho que a regra citou, para conferir a alegação sem abrir o PDF. */
  evidencia: string;
};

/** Quanto de cada campo vale guardar. Parecer inteiro cabe em 4 MB. */
const TETO_MOTIVO = 220;
const TETO_EVIDENCIA = 240;

export function registrarContestacao(
  finding: AuditFinding,
  motivo: unknown,
): ContestacaoDeRegra {
  return {
    achado: String(finding.id ?? ""),
    tipo: String(finding.tipo ?? ""),
    pagina: String(finding.pagina ?? ""),
    motivo:
      String(motivo ?? "").replace(/\s+/g, " ").trim().slice(0, TETO_MOTIVO) ||
      "(a validação pediu remoção sem declarar motivo)",
    evidencia: String(finding.evidencia ?? "").replace(/\s+/g, " ").trim().slice(0, TETO_EVIDENCIA),
  };
}

/**
 * A linha de log da contestação.
 *
 * Vai para o log ALÉM de ir para o parecer: quem está mexendo numa regra hoje
 * vê o desacordo na hora, sem precisar abrir o parecer gravado.
 */
export function linhaDeLog(c: ContestacaoDeRegra): string {
  return `[audit] regra contestada pela validação: ${c.achado} "${c.tipo}" (p.${c.pagina}) :: ${c.motivo}`;
}
