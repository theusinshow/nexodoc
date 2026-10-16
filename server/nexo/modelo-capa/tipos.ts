/**
 * O MODELO DE CAPA ANEXADO — os tipos do núcleo puro.
 * Desenho: docs/superpowers/specs/2026-10-16-capa-anexada-design.md
 * PURO: nenhum import.
 */
export type CampoDaCapa =
  | "ORGAO"
  | "SECRETARIA"
  | "NOME_OBRA"
  | "BAIRRO"
  | "FASE"
  | "TITULO_CAPA"
  | "DISCIPLINA"
  | "TOMO"
  | "VOLUME"
  | "MES_ANO"
  | "CODIGO_EXIBIDO";

export const CAMPOS_DA_CAPA: readonly CampoDaCapa[] = [
  "ORGAO",
  "SECRETARIA",
  "NOME_OBRA",
  "BAIRRO",
  "FASE",
  "TITULO_CAPA",
  "DISCIPLINA",
  "TOMO",
  "VOLUME",
  "MES_ANO",
  "CODIGO_EXIBIDO",
];

/** Um pedaço do parágrafo: texto fixo, ou o valor de um campo. */
export interface Trecho {
  texto: string;
  campo: CampoDaCapa | "FIXO";
}

export interface ParagrafoDaCapa {
  /** Posição na enumeração COMPLETA do corpo (a de `lerLayoutDoModelo`). */
  indice: number;
  /** Texto visível, entidades XML decodificadas. */
  texto: string;
}

export interface ParagrafoClassificado extends ParagrafoDaCapa {
  /** `null` = ninguém classificou ainda (vai para a IA). */
  trechos: Trecho[] | null;
  origem: "regra" | "ia" | "pessoa" | null;
}

export type FormatoDoTomo = "parenthesized-padded" | "parenthesized" | "plain-padded" | "plain";
export type FormatoDoVolume = "roman" | "numeric";

export interface PropostaDeModelo {
  paragrafos: ParagrafoClassificado[];
  tomoFormat: FormatoDoTomo | null;
  volumeFormat: FormatoDoVolume | null;
}

export interface ContextoDasRegras {
  /** Obra do projeto (`Project.identidade`/nome), para reconhecer as linhas dela. */
  obra?: string;
  bairro?: string;
  /** `defaults.orgao` dos modelos de prefeitura. */
  orgaos: string[];
  /** `defaults.secretaria` dos modelos de prefeitura (vazias fora). */
  secretarias: string[];
}
