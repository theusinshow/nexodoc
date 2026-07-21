/**
 * Tipos do modulo Nexo (assistente conversacional que orquestra os demais
 * modulos do NexoDoc). Primeira versao do "Dossie do Projeto": o objeto unico
 * de estado que o agente vai construindo ao longo da conversa e que alimenta
 * cada ferramenta (LD, capas, separatrizes, volume, auditoria) sem redigitacao.
 *
 * Fase 0 do roadmap (docs/nexo-roadmap.md). Ainda vai evoluir — nao tratar como
 * contrato estavel.
 */

/** Arquivo enviado pelo usuario, antes/depois de classificado. */
export interface NexoInputFile {
  id: string;
  name: string;
  sizeBytes: number;
  /** Disciplina detectada pela classificacao (ex.: "HIDROSSANITARIO"), quando houver. */
  disciplinaDetectada?: string;
  /** Numero de pranchas/paginas detectadas, quando aplicavel. */
  paginas?: number;
}

/** Fato do dossie: valor + origem + se ja foi confirmado pelo usuario. */
export interface NexoFact<T> {
  value: T;
  /** Como o valor chegou: extraido de arquivo, herdado de projeto, ou digitado. */
  origem: "extraido" | "projeto" | "usuario" | "sugerido";
  /** Fatos de alto risco so entram no documento apos confirmacao explicita. */
  confirmado: boolean;
}

/** Estado consolidado que o agente monta e cada ferramenta consome. */
export interface NexoDossie {
  id: string;
  projectId?: string;
  obra?: NexoFact<string>;
  orgao?: NexoFact<string>;
  codigo?: NexoFact<string>;
  revisao?: NexoFact<string>;
  fase?: NexoFact<string>;
  disciplinas: string[];
  arquivos: NexoInputFile[];
  /** Artefatos ja produzidos pelas ferramentas nesta sessao. */
  artefatos: NexoArtifact[];
}

export type NexoArtifactKind = "ld" | "capa" | "separatriz" | "volume" | "auditoria";

export interface NexoArtifact {
  kind: NexoArtifactKind;
  status: "proposto" | "confirmado" | "gerado" | "erro";
  label: string;
  /** URL/base64 do resultado quando gerado (odt/pdf/zip/relatorio). */
  url?: string;
}

/** Papel de cada mensagem no chat do Nexo. */
export type NexoRole = "user" | "assistant";

export interface NexoMessage {
  id: string;
  role: NexoRole;
  content: string;
}
