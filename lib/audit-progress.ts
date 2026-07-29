/**
 * O vocabulário do progresso da auditoria.
 *
 * A tela mostrava as etapas ESTIMADAS pelo relógio, porque `/api/audit` era um
 * POST único sem sinal nenhum de progresso. Estimativa envelhece mal: num
 * documento grande a barra passava do previsto e a interface não tinha como
 * saber se estava perto do fim ou parada.
 *
 * Aqui cada marco é um FATO do motor, emitido no ponto onde o trabalho começa e
 * termina de verdade. A regra que governa este arquivo: só entra o que se pode
 * afirmar naquele instante. Nada de porcentagem dentro de uma chamada atômica —
 * a leitura global e a validação são uma ida só ao modelo, sem sinal interno —,
 * nada de "quase lá", e nenhuma contagem de achados antes da passada retornar.
 *
 * O que a UI faz com o marco é problema dela; o motor só relata.
 */

/** Identidade estável de cada passada. A UI mapeia isto para o texto que mostra. */
export type PassadaDaAuditoria =
  | "extracao"
  | "regras"
  | "global"
  | "blocos"
  | "evidencia"
  | "confronto"
  | "validacao"
  | "parecer";

export interface MarcoDaAuditoria {
  passada: PassadaDaAuditoria;
  estado: "inicio" | "fim";
  /** Fato medido no instante do marco (ex.: "132 páginas, 314848 caracteres"). */
  detalhe?: string;
  /** Só nas passadas que têm unidades contáveis de verdade (blocos). */
  indice?: number;
  total?: number;
  /**
   * Teto de tempo da passada, quando ele existe. É o que permite dizer "passou
   * do previsto" sem inventar progresso — e o rebaixamento para ANÁLISE PARCIAL,
   * que só é conhecido no fim, confirma o que a interface já preparou.
   */
  orcamentoMs?: number;
}

export type EmitirMarco = (marco: MarcoDaAuditoria) => void;

/** Nome legível de cada passada, em linguagem de documento e não de código. */
export const NOME_DA_PASSADA: Record<PassadaDaAuditoria, string> = {
  extracao: "Abrindo o memorial",
  regras: "Conferindo identidade e coerência",
  global: "Lendo o documento",
  blocos: "Lendo capítulo a capítulo",
  evidencia: "Conferindo as evidências no texto",
  confronto: "Comparando os documentos entre si",
  validacao: "Revisando cada achado com um segundo modelo",
  parecer: "Fechando o parecer",
};
