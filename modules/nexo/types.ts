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

/**
 * Resultado da classificacao deterministica de UM arquivo no intake (sem IA).
 * Composto por `classifyDocument` (tipo/identidade) + `classifyPageAsset`
 * (disciplina). Alimenta o "afirma fatos, pergunta decisoes".
 */
export interface NexoFileClassification {
  fileName: string;
  /** Caminho relativo quando veio de upload de pasta (blocos/tomos). */
  relPath?: string;
  /** NexoDocTipo do parser: memorial | capa | separatriz | prancha | volume | orcamento | outro. */
  tipo: string;
  tipoLabel: string;
  /** true = orcamento (fora do escopo do Nexo); conteudo nem e lido. */
  foraDeEscopo: boolean;
  /** versao assinada (duplicata do documento). */
  assinado: boolean;
  obra: string;
  municipio: string;
  orgao: string;
  /** Do nome do arquivo (autoritativo), com fallback no conteudo. */
  codigo: string;
  revisao: string;
  /** Codigos de disciplina do nome/pasta (multi). */
  disciplinas: string[];
  folha?: string;
  volume?: string;
  pageCount: number;
  charCount: number;
  confianca: "alta" | "media" | "baixa";
  precisaOcr: boolean;
  sinais: string[];
}

/** Contagem de documentos por papel dentro de um volume. */
export interface NexoVolumeCounts {
  memoriais: number;
  capas: number;
  separatrizes: number;
  pranchas: number;
  volumes: number;
  outros: number;
}

/** Um volume do projeto, com seus arquivos e disciplinas. */
export interface NexoVolumeGroup {
  numero?: string;
  rotulo: string;
  disciplinas: string[];
  contagem: NexoVolumeCounts;
  arquivos: NexoFileClassification[];
}

/** Dossie parcial montado pelo intake: fatos agregados + estrutura + por-arquivo. */
export interface NexoDossieDraft {
  obra?: string;
  orgao?: string;
  municipio?: string;
  codigo?: string;
  revisao?: string;
  disciplinas: string[];
  /** Estrutura por volume (agrupa pranchas/capas/separatrizes). */
  volumes: NexoVolumeGroup[];
  /** Arquivos sem volume identificado (memorial geral, avulsos). */
  semVolume: NexoFileClassification[];
  arquivos: NexoFileClassification[];
}

/** Papel de cada mensagem no chat do Nexo. */
export type NexoRole = "user" | "assistant";

/**
 * Parâmetros que o agente PROPÕE para uma LD (nada gerado ainda). São decisões
 * editáveis: o engenheiro confirma/corrige no card antes de gerar.
 */
export interface NexoLdProposalParams {
  /** Título da seção (varia por projeto). Vazio = engenheiro decide. */
  tituloLd: string;
  /** Divide as folhas em N tomos. Default 1. */
  numTomos: number;
}

/** Parâmetros propostos para uma capa. Editáveis antes de gerar. */
export interface NexoCapaProposalParams {
  /** Template (prefeitura + variante) que fornece órgão/secretaria/formato. */
  templateId: string;
  /** Volume arábico ("1","2"...); "" = deriva do nome do arquivo. */
  volume: string;
  /** Divide em N tomos (uma capa por tomo). Default 1. */
  numTomos: number;
}

/**
 * Proposta estruturada do agente. O card renderiza os params (editáveis) e os
 * botões [Confirmar e gerar] / [Corrigir]. A geração (irreversível) só acontece
 * no clique, chamando as rotas determinísticas — a IA nunca gera o documento.
 */
export type NexoAgentProposal =
  | { kind: "ld"; resumo: string; params: NexoLdProposalParams }
  | { kind: "capa"; resumo: string; params: NexoCapaProposalParams };

/** Um turno de resposta do agente: texto conversacional + propostas (0+). */
export interface NexoAgentTurn {
  reply: string;
  proposals: NexoAgentProposal[];
}

export interface NexoMessage {
  id: string;
  role: NexoRole;
  content: string;
  /** Propostas anexadas a uma mensagem do assistente (renderizam como cards). */
  proposals?: NexoAgentProposal[];
}
