/**
 * A CERTEZA MEDIDA — a parte pura, sem rede e sem `@/`.
 *
 * Vive separada de `encaixe-3-certeza.ts` pelo mesmo motivo que `ai-precos.ts`
 * vive separada de `ai-usage.ts`: aquele módulo fala com o Jev e, por tabela,
 * arrasta `@/lib/db` atrás. `lib/severidade.ts` só precisa do TIPO e da conta
 * de três degraus — e `scripts/test-severidade.ts` roda sem o resolver de
 * alias. Misturar as duas coisas faria a matriz de severidade ficar
 * intestável fora do Next, que é o oposto do que ela precisa ser.
 *
 * Aqui não entra nada que faça I/O.
 */

import type { FindingImpact } from "../audit-report.ts";

/** A certeza medida de um achado, na escala 0–1, e a faixa quando faltava. */
export type CertezaMedida = {
  findingId: string;
  /** P(o achado é um defeito real), medida pelo conferente. */
  probabilidade: number;
  /**
   * O quanto o trecho citado basta para decidir. NÃO entra na probabilidade —
   * só impede a promoção ao teto da faixa. Ver `grauDaCerteza`.
   */
  decidibilidade?: number;
  /** Só preenchida quando o achado chegou SEM `impacto` declarado. */
  faixaSugerida?: FindingImpact;
  /** Quanto o conferente confia na própria escolha de faixa. */
  confiancaDaFaixa?: number;
};

/**
 * ALTA E BAIXA NÃO SÃO SIMÉTRICAS, e os cortes são tortos de propósito.
 *
 * Subir move o achado para o TETO da faixa e custa atenção do engenheiro.
 * Descer o move para o PISO, e é o começo do caminho que fez achado sumir em
 * agosto/2026. Quando a medição é ambígua, o empate vai para o meio — nunca
 * para baixo.
 */
const SUBIR = 0.8;
const DESCER = 0.45;

/**
 * A probabilidade medida virando o degrau que `severidade.ts` já sabe usar.
 *
 * Três degraus é o máximo que o número aguenta sustentar enquanto a calibração
 * do fornecedor não for conferida com dado nosso — o ECE publicado é 4,4x o
 * piso. Ler a probabilidade como se fosse exata seria emprestar a ela uma
 * precisão que ninguém mediu.
 *
 * A DECIDIBILIDADE SÓ SEGURA A PROMOÇÃO, nunca empurra para baixo. Medido em
 * 21/09/2026 nos 13 casos de `prova-conferente-certeza.ts`: ela fica baixa para
 * quase tudo (0,22 a 0,48), porque conferir quase qualquer achado de memorial
 * "precisaria de outro documento" numa leitura estrita. A primeira versão deste
 * encaixe multiplicava a probabilidade por ela, e o "0,254 microns" — erro de
 * mil vezes, conferido no PDF — saía a 0,26 e caía no piso.
 */
export function grauDaCerteza(
  probabilidade: number,
  decidibilidade = 1,
): "alta" | "media" | "baixa" {
  if (probabilidade >= SUBIR && decidibilidade >= 0.5) return "alta";
  if (probabilidade >= SUBIR) return "media";
  if (probabilidade < DESCER) return "baixa";
  return "media";
}
